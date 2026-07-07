"use client";

import { forwardRef, memo, useEffect, useRef, useState } from "react";
import { Player } from "@remotion/player";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Captions,
  ChevronLeft,
  Download,
  Loader2,
  Music,
  Pause,
  Play,
  Trash2,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SeedanceReelComposition, calcSeedanceReelDurationInFrames } from "@/lib/remotion/SeedanceReelComposition";
import { calcDurationInFrames, clampBrollClips, applyCutRanges, mapVirtualRangeToOriginal } from "@/lib/remotion/duration";
import { EDITABLE_SOURCES } from "@/lib/editable-sources";
import { CAPTION_PRESETS } from "@/lib/remotion/caption-presets";
import { CaptionsPanel } from "@/modules/edit/components/caption-panel";
import { OverlaysPanel } from "@/modules/edit/components/overlays-panel";
import { OverlaysCanvasLayer } from "@/modules/edit/components/overlays-canvas-layer";
import { MusicPanel } from "@/modules/edit/components/music-panel";
import { Timeline } from "@/modules/edit/components/timeline-ruler";
import { loadDraft, saveDraft, clearDraft, draftKeyFor } from "@/modules/edit/utils/draft";

const FPS = 30;

// Identifies which composition a saved draft belongs to — if the user opens
// a different video, a stale draft from a previous one won't get applied.
function draftSignature(compositionProps) {
  return [
    compositionProps.source,
    compositionProps.avatarVideoUrl,
    compositionProps.ctaVideoUrl,
    compositionProps.part2AudioUrl,
  ].join("|");
}

function createOverlay(type) {
  const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  if (type === "text") {
    return {
      id, type, x: 50, y: 50, width: 60,
      text: "Your text here", fontSize: 56, color: "#ffffff", fontFamily: "sans",
      bgColor: "#000000", bgOpacity: 0,
      hidden: false,
    };
  }
  return { id, type: "image", x: 50, y: 50, width: 40, url: "", aspect: null, hidden: false };
}

function buildBaseRenderProps(compositionProps, overlays = [], music = null, cutRanges = []) {
  return {
    ...compositionProps,
    overlays,
    musicUrl:              music?.url || "",
    musicTrimStartSeconds: music?.trimStart || 0,
    musicVolume:           music?.volume ?? 0.25,
    cutRanges,
    brollClips: clampBrollClips({
      avatarDuration: compositionProps.avatarDuration,
      brollClips:     compositionProps.brollClips,
      ctaDuration:    compositionProps.ctaDuration,
      showIntro:      false,
      showOutro:      false,
    }),
    showIntro:      false,
    showOutro:      false,
    introTitle:     "",
    introSubtitle:  "",
    introTagline:   "",
    outroBrandText: "thumbpin.ai",
    ctaText:        compositionProps.ctaText || "",
  };
}

function formatTime(seconds) {
  const clamped = Math.max(0, seconds);
  const m = Math.floor(clamped / 60);
  const s = Math.floor(clamped % 60);
  const ms = Math.floor((clamped % 1) * 1000);
  return `${m}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

// Isolated from Editor's frame-state re-renders via memo + forwardRef.
// compositionProps comes from a reducer and is a stable reference during playback,
// so this component only re-renders when the user actually changes the composition.
const PlayerContainer = memo(
  forwardRef(function PlayerContainer({ compositionProps, durationInFrames, overlays, music, cutRanges }, ref) {
    const clampedBrollClips = clampBrollClips({
      avatarDuration: compositionProps.avatarDuration,
      brollClips:     compositionProps.brollClips,
      ctaDuration:    compositionProps.ctaDuration,
      showIntro:      false,
      showOutro:      false,
    });

    const previewProps = {
      ...compositionProps,
      brollClips:     clampedBrollClips,
      showIntro:      false,
      showOutro:      false,
      introTitle:     "",
      introSubtitle:  "",
      introTagline:   "",
      outroBrandText: "thumbpin.ai",
      ctaText:        compositionProps.ctaText || "",
      overlays:       overlays || [],
      musicUrl:              music?.url || "",
      musicTrimStartSeconds: music?.trimStart || 0,
      musicVolume:           music?.volume ?? 0.25,
      cutRanges:             cutRanges || [],
    };

    return (
      <Player
        ref={ref}
        component={SeedanceReelComposition}
        inputProps={previewProps}
        durationInFrames={durationInFrames}
        compositionWidth={1080}
        compositionHeight={1920}
        fps={FPS}
        style={{ width: "100%", height: "100%", display: "block" }}
        loop
        clickToPlay
      />
    );
  })
);

export function Editor({ compositionProps, onExit }) {
  const signature = draftSignature(compositionProps);
  const draftKey = draftKeyFor(compositionProps);
  // Read once per mount — a draft only ever applies to the composition it
  // was saved for, so a different video never inherits stale edits.
  const [initialDraft] = useState(() => {
    const stored = loadDraft(draftKey);
    return stored && stored.signature === signature ? stored : null;
  });

  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStatus, setRenderStatus] = useState("");
  const [renderError, setRenderError] = useState(null);
  const [activePanel, setActivePanel] = useState(initialDraft?.activePanel ?? null);
  const [captionState, setCaptionState] = useState(
    initialDraft?.captionState || { preset: null, status: "idle", progress: 0, message: "", videoUrl: null, error: null }
  );
  const [captionDraft, setCaptionDraft] = useState(null);

  const [overlays, setOverlays] = useState(initialDraft?.overlays || []);
  const [selectedOverlayId, setSelectedOverlayId] = useState(null);
  const [editingOverlayId, setEditingOverlayId] = useState(null);
  const [overlayUploading, setOverlayUploading] = useState(false);
  const canvasBoxRef = useRef(null);

  const [music, setMusic] = useState(initialDraft?.music || null); // { key, url, name, trimStart } | null

  const [cutRanges, setCutRanges] = useState(initialDraft?.cutRanges || []); // [{ start, end }] in the ORIGINAL (uncut) timeline

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const playerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(0);
  const [trim, setTrim] = useState(initialDraft?.trim || { in: 0, out: 0 });

  const captionVideoRef = useRef(null);
  const [captionPlaying, setCaptionPlaying] = useState(false);
  const [captionTime, setCaptionTime] = useState(0);
  const [captionDuration, setCaptionDuration] = useState(0);

  const sourceConfig = EDITABLE_SOURCES[compositionProps.source] || {};

  const clampedBrollClipsForDuration = clampBrollClips({
    avatarDuration: compositionProps.avatarDuration,
    brollClips:     compositionProps.brollClips,
    ctaDuration:    compositionProps.ctaDuration,
    showIntro:      false,
    showOutro:      false,
  });

  // Length of the raw, uncut reel — cutRanges (from the ruler's Cut tool)
  // are stored in this original timeline's frame coordinates.
  const originalDurationInFrames = calcDurationInFrames({
    avatarDuration: compositionProps.avatarDuration,
    brollClips:     clampedBrollClipsForDuration,
    ctaDuration:    compositionProps.ctaDuration,
    showIntro:      false,
    showOutro:      false,
  });

  // What the Player/Timeline actually work with — the reel's length after
  // cuts ripple everything shorter. Must match calcSeedanceReelDurationInFrames
  // used server-side, so preview and export always agree.
  const durationInFrames = calcSeedanceReelDurationInFrames({
    avatarDuration: compositionProps.avatarDuration,
    brollClips:     clampedBrollClipsForDuration,
    ctaDuration:    compositionProps.ctaDuration,
    showIntro:      false,
    showOutro:      false,
    cutRanges,
  });

  const { keepRanges } = applyCutRanges(originalDurationInFrames, cutRanges);

  // Autosave the edit — so leaving the editor (or refreshing) never loses
  // overlays/music/cuts/trim/caption progress for this composition, and it
  // shows up as a resumable card on the /app/edit drafts dashboard.
  useEffect(() => {
    saveDraft(draftKey, { signature, compositionProps, overlays, music, cutRanges, trim, captionState, activePanel });
  }, [draftKey, signature, compositionProps, overlays, music, cutRanges, trim, captionState, activePanel]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onPlay        = () => setPlaying(true);
    const onPause       = () => setPlaying(false);
    const onFrameUpdate = (e) => setFrame(e.detail.frame);
    player.addEventListener("play",        onPlay);
    player.addEventListener("pause",       onPause);
    player.addEventListener("frameupdate", onFrameUpdate);
    return () => {
      player.removeEventListener("play",        onPlay);
      player.removeEventListener("pause",       onPause);
      player.removeEventListener("frameupdate", onFrameUpdate);
    };
  }, []);

  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    if (playing) {
      player.pause();
    } else {
      if (frame < trim.in) {
        player.seekTo(trim.in);
        setFrame(trim.in);
      }
      player.play();
    }
  };

  useEffect(() => {
    const el = captionVideoRef.current;
    if (!el) return;
    const onPlay             = () => setCaptionPlaying(true);
    const onPause            = () => setCaptionPlaying(false);
    const onTimeUpdate       = () => setCaptionTime(el.currentTime);
    const onLoadedMetadata   = () => setCaptionDuration(el.duration || 0);
    el.addEventListener("play",            onPlay);
    el.addEventListener("pause",           onPause);
    el.addEventListener("timeupdate",      onTimeUpdate);
    el.addEventListener("loadedmetadata",  onLoadedMetadata);
    return () => {
      el.removeEventListener("play",            onPlay);
      el.removeEventListener("pause",           onPause);
      el.removeEventListener("timeupdate",      onTimeUpdate);
      el.removeEventListener("loadedmetadata",  onLoadedMetadata);
    };
  }, [captionState.videoUrl]);

  const toggleCaptionPlay = () => {
    const el = captionVideoRef.current;
    if (!el) return;
    if (el.paused) el.play(); else el.pause();
  };

  const handleDownload = async () => {
    if (captionState.videoUrl) {
      const filename = sourceConfig.downloadFilename || "video.mp4";
      const sep = captionState.videoUrl.includes("?") ? "&" : "?";
      const a = document.createElement("a");
      a.href = `${captionState.videoUrl}${sep}download=1&filename=${filename}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Reel with captions downloading…");
      return;
    }

    setRendering(true);
    setRenderProgress(0);
    setRenderStatus("Starting…");
    setRenderError(null);
    try {
      const trimInFrame  = trim.in;
      const trimOutFrame = trim.out > 0 ? trim.out : durationInFrames;

      const renderProps = {
        ...buildBaseRenderProps(compositionProps, overlays, music, cutRanges),
        trimInFrame,
        trimOutFrame,
      };

      const res = await fetch(sourceConfig.renderEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(renderProps),
      });

      if (!res.ok) throw new Error(`Render failed: ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer   = "";
      let finalUrl = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event;
          try { event = JSON.parse(line.slice(6)); } catch (_) { continue; }
          if (event.type === "progress") setRenderProgress(event.progress);
          if (event.type === "status")   setRenderStatus(event.message);
          if (event.type === "done")     finalUrl = event.url;
          if (event.type === "error")    throw new Error(event.error);
        }
      }

      if (!finalUrl) throw new Error("No URL returned from render");

      const filename = sourceConfig.downloadFilename || "video.mp4";
      const sep = finalUrl.includes("?") ? "&" : "?";
      const a = document.createElement("a");
      a.href = `${finalUrl}${sep}download=1&filename=${filename}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      toast.success("Reel rendered! Download starting…");
    } catch (err) {
      console.error("[Editor] Render failed:", err);
      setRenderError(err.message || "Render failed");
      toast.error("Render failed", { description: err.message });
    } finally {
      setRendering(false);
      setRenderProgress(0);
      setRenderStatus("");
    }
  };

  const handleGenerateCaptions = async (preset, language, translationLanguage, position) => {
    setCaptionState({ preset, status: "rendering", progress: 0, message: "Assembling video…", videoUrl: null, error: null });
    try {
      const res = await fetch(sourceConfig.renderEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBaseRenderProps(compositionProps, overlays, music, cutRanges)),
      });

      if (!res.ok) throw new Error(`Render failed: ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer   = "";
      let finalUrl = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event;
          try { event = JSON.parse(line.slice(6)); } catch (_) { continue; }
          if (event.type === "progress") setCaptionState((s) => ({ ...s, progress: event.progress }));
          if (event.type === "status")   setCaptionState((s) => ({ ...s, message: event.message }));
          if (event.type === "done")     finalUrl = event.url;
          if (event.type === "error")    throw new Error(event.error);
        }
      }

      if (!finalUrl) throw new Error("No URL returned from render");

      setCaptionState((s) => ({ ...s, status: "captioning", progress: 0, message: "Applying captions…" }));

      const capRes = await fetch("/api/captions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: finalUrl,
          preset,
          language: language || undefined,
          translationLanguage: translationLanguage || undefined,
          position: position || undefined,
        }),
      });

      const capData = await capRes.json();
      if (!capRes.ok) throw new Error(capData.error || `Captioning failed: ${capRes.status}`);

      setCaptionState({ preset, status: "done", progress: 100, message: "", videoUrl: capData.url, error: null });
      setCaptionDraft(null);
    } catch (err) {
      console.error("[Editor] Caption generation failed:", err);
      setCaptionState((s) => ({ ...s, status: "error", error: err.message || "Caption generation failed" }));
    }
  };

  const handleAddTextOverlay = () => {
    const overlay = createOverlay("text");
    setOverlays((prev) => [...prev, overlay]);
    setSelectedOverlayId(overlay.id);
  };

  const handleAddImageOverlay = async (file) => {
    setOverlayUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", "Overlay image");
      formData.append("type", "overlay");
      formData.append("category", "overlays");

      const res = await fetch("/api/assets/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      const overlay = { ...createOverlay("image"), url: data.asset.url };
      setOverlays((prev) => [...prev, overlay]);
      setSelectedOverlayId(overlay.id);
    } catch (err) {
      console.error("[Editor] Overlay image upload failed:", err);
      toast.error("Image upload failed", { description: err.message });
    } finally {
      setOverlayUploading(false);
    }
  };

  const handleUpdateOverlay = (id, patch) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const handleMoveOverlay = (id, { x, y }) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, x, y } : o)));
  };

  const handleRemoveOverlay = (id) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    setSelectedOverlayId((prev) => (prev === id ? null : prev));
  };

  const handleToggleOverlayHidden = (id) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, hidden: !o.hidden } : o)));
  };

  // newOrder is the full overlays array in its new stacking order (index 0 =
  // back of the stack, last = front) — the panel computes this from drag.
  const handleReorderOverlays = (newOrder) => {
    setOverlays(newOrder);
  };

  const handleStartEditOverlay = (id) => {
    setSelectedOverlayId(id);
    setEditingOverlayId(id);
  };

  const handleStopEditOverlay = () => setEditingOverlayId(null);

  const handleSelectMusic = (track) => {
    setMusic({ key: track.key, url: track.url, name: track.name, trimStart: 0, volume: 0.25 });
  };

  const handleTrimMusic = (trimStart) => {
    setMusic((prev) => (prev ? { ...prev, trimStart } : prev));
  };

  const handleVolumeMusic = (volume) => {
    setMusic((prev) => (prev ? { ...prev, volume } : prev));
  };

  const handleClearMusic = () => setMusic(null);

  // start/end here are VIRTUAL (already-cut) frame positions from the ruler —
  // map them back to the original timeline before storing, so the excluded
  // range survives future cuts/ripples correctly.
  const handleDeleteSegment = (virtualStart, virtualEnd) => {
    const originalRanges = mapVirtualRangeToOriginal(virtualStart, virtualEnd, keepRanges);
    if (originalRanges.length === 0) return;
    setCutRanges((prev) => [...prev, ...originalRanges]);
    const seekTarget = Math.max(0, virtualStart - 1);
    setFrame(seekTarget);
    playerRef.current?.seekTo(seekTarget);
  };

  const handleRestoreLastCut = () => {
    setCutRanges((prev) => prev.slice(0, -1));
  };

  const hasDraftContent =
    overlays.length > 0 ||
    cutRanges.length > 0 ||
    !!music ||
    trim.in > 0 ||
    trim.out > 0 ||
    captionState.status === "done";

  const handleDiscardDraft = () => {
    clearDraft(draftKey);
    setOverlays([]);
    setSelectedOverlayId(null);
    setEditingOverlayId(null);
    setMusic(null);
    setCutRanges([]);
    setTrim({ in: 0, out: 0 });
    setCaptionState({ preset: null, status: "idle", progress: 0, message: "", videoUrl: null, error: null });
    setCaptionDraft(null);
    setActivePanel(null);
    setShowDiscardConfirm(false);
    toast.success("Draft discarded — back to the original reel.");
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-12 z-10 bg-[#fafbfc] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-6 py-2 shrink-0 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onExit}
            className="h-8 text-xs bg-black text-[#c7f038] hover:bg-black hover:opacity-90"
          >
            Back
          </Button>
          <div>
            <h1 className="text-base font-bold font-heading tracking-tight">Edit Reel</h1>
            <p className="text-xs text-muted-foreground truncate max-w-xs">{compositionProps.name || "Untitled reel"}</p>
          </div>
        </div>
        <div className="flex gap-4 items-center justify-center">
          {hasDraftContent && (
            <Button
              onClick={() => setShowDiscardConfirm(true)}
              className="gap-2 border border-red-500 text-white hover:bg-red-600 bg-red-500 duration-300 hover:text-white"
            >
              <Trash2 className="w-4 h-4" />
              Discard draft
            </Button>
          )}
          <div className="flex flex-col items-end gap-1">
          <Button onClick={handleDownload} disabled={rendering} className="gap-2 bg-linear-to-b from-black to-neutral-600 text-[#c7f038] min-w-32">
            {rendering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span className="truncate">{renderProgress > 0 ? `${renderProgress}%` : renderStatus || "Rendering…"}</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export
              </>
            )}
          </Button>
          {rendering && renderProgress > 0 && (
            <div className="w-32 h-1 rounded-full bg-neutral-200 overflow-hidden">
              <div
                className="h-full bg-[#c7f038] rounded-full transition-all duration-300"
                style={{ width: `${renderProgress}%` }}
              />
            </div>
          )}
          {renderError && (
            <div className="flex items-start gap-1 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{renderError}</span>
            </div>
          )}
        </div>
          </div>
      </div>

      {/* Canvas + right panel */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Main canvas */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-4 px-6 bg-[#fafbfc]">
          <div
            ref={canvasBoxRef}
            className="relative rounded-2xl overflow-hidden border border-border/50 bg-black shadow-xl"
            style={{ aspectRatio: "9/16", height: "calc(100% - 2.5rem)", maxHeight: "100%" }}
          >
            {captionState.videoUrl ? (
              <video
                ref={captionVideoRef}
                src={captionState.videoUrl}
                onClick={toggleCaptionPlay}
                playsInline
                className="w-full h-full object-contain bg-black cursor-pointer"
              />
            ) : (
              <PlayerContainer
                ref={playerRef}
                compositionProps={compositionProps}
                durationInFrames={durationInFrames}
                overlays={overlays}
                music={music}
                cutRanges={cutRanges}
              />
            )}

            {!captionState.videoUrl && activePanel === "overlays" && (
              <OverlaysCanvasLayer
                containerRef={canvasBoxRef}
                overlays={overlays.filter((o) => !o.hidden)}
                selectedId={selectedOverlayId}
                editingId={editingOverlayId}
                onSelect={setSelectedOverlayId}
                onMove={handleMoveOverlay}
                onLoadAspect={(id, aspect) => handleUpdateOverlay(id, { aspect })}
                onStartEdit={handleStartEditOverlay}
                onEditChange={(id, text) => handleUpdateOverlay(id, { text })}
                onStopEdit={handleStopEditOverlay}
              />
            )}

            {!captionState.videoUrl && captionDraft && (
              <div
                className={`absolute inset-x-0 flex px-6 pointer-events-none ${
                  captionDraft.position === "top"
                    ? "top-8 justify-center"
                    : captionDraft.position === "center"
                    ? "inset-y-0 items-center justify-center"
                    : "bottom-8 justify-center"
                }`}
              >
                <span className="rounded-sm background-blur-sm bg-black/50 px-4 py-2 text-sm text-white text-center">
                  Your text here
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {captionState.videoUrl ? (
              <>
                <button
                  onClick={toggleCaptionPlay}
                  className="h-7 w-7 rounded-full bg-neutral-900 text-white flex items-center justify-center hover:bg-neutral-800 transition-colors shrink-0"
                >
                  {captionPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
                </button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatTime(captionTime)} / {formatTime(captionDuration)}
                </span>
              </>
            ) : (
              <>
                <button
                  onClick={togglePlay}
                  className="h-7 w-7 rounded-full bg-neutral-900 text-white flex items-center justify-center hover:bg-neutral-800 transition-colors shrink-0"
                >
                  {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
                </button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatTime(Math.max(0, frame - trim.in) / FPS)} / {formatTime(((trim.out > 0 ? trim.out : durationInFrames) - trim.in) / FPS)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-88 shrink-0 border-l border-border/50 bg-white flex flex-col overflow-hidden">
          {activePanel ? (
            <>
              <div className="flex items-center gap-2 px-3 py-3 border-b border-border/40 shrink-0">
                <button
                  onClick={() => {
                    setActivePanel(null);
                    setCaptionDraft(null);
                    setSelectedOverlayId(null);
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold capitalize">{activePanel}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {activePanel === "captions" && (
                  <CaptionsPanel
                    captionState={captionState}
                    onGenerate={handleGenerateCaptions}
                    onDraftChange={setCaptionDraft}
                    onReset={() => setCaptionState({ preset: null, status: "idle", progress: 0, message: "", videoUrl: null, error: null })}
                  />
                )}
                {activePanel === "music" && (
                  <MusicPanel
                    music={music}
                    reelDurationSeconds={durationInFrames / FPS}
                    onSelect={handleSelectMusic}
                    onTrimChange={handleTrimMusic}
                    onVolumeChange={handleVolumeMusic}
                    onClear={handleClearMusic}
                  />
                )}
                {activePanel === "overlays" && (
                  <OverlaysPanel
                    overlays={overlays}
                    selectedId={selectedOverlayId}
                    onSelect={setSelectedOverlayId}
                    onAddText={handleAddTextOverlay}
                    onAddImage={handleAddImageOverlay}
                    onUpdate={handleUpdateOverlay}
                    onRemove={handleRemoveOverlay}
                    onToggleHidden={handleToggleOverlayHidden}
                    onReorder={handleReorderOverlays}
                    uploading={overlayUploading}
                  />
                )}
              </div>
            </>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border/40 shrink-0">
                <span className="text-sm font-semibold">Edit</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                {[
                  { id: "captions", label: "Captions",             Icon: Captions, desc: "Add or edit captions" },
                  { id: "music",    label: "Music",                 Icon: Music,    desc: "Add background music" },
                  { id: "overlays", label: "Text / Image Overlays", Icon: Type,     desc: "Add text or images" },
                ].map(({ id, label, Icon, desc }) => (
                  <button
                    key={id}
                    onClick={() => setActivePanel(id)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl border border-border/50 hover:bg-muted/40 hover:border-border transition-colors text-left w-full"
                  >
                    <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-neutral-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{label}</p>
                      <p className="text-[11px] text-muted-foreground">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="shrink-0 px-6 pb-3 pt-2 bg-[#fafbfc] border-t border-border/50">
        <Timeline
          durationInFrames={durationInFrames}
          frame={frame}
          fps={FPS}
          audioUrl={compositionProps.avatarVideoUrl || null}
          captions={
            captionState.status === "done"
              ? [{
                  startFrame: 0,
                  endFrame:   durationInFrames,
                  label:      CAPTION_PRESETS.find((p) => p.id === captionState.preset)?.label || "Captions",
                }]
              : []
          }
          onSeek={(f) => {
            setFrame(f);
            playerRef.current?.seekTo(f);
          }}
          onTrimChange={({ trimIn, trimOut }) => setTrim({ in: trimIn, out: trimOut })}
          onDeleteSegment={handleDeleteSegment}
          cutCount={cutRanges.length}
          onRestoreLastCut={handleRestoreLastCut}
          onToolbarAction={(action) => {
            if (!action?.startsWith("add:")) return;
            const panel = action.slice(4);
            setActivePanel((prev) => (prev === panel ? null : panel));
          }}
        />
      </div>

      <Dialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <DialogTitle>Discard draft?</DialogTitle>
            </div>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes all overlays, music, cuts, trim, and captions you&apos;ve added and goes back to the
            original reel. This can&apos;t be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowDiscardConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDiscardDraft}>
              Discard draft
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
