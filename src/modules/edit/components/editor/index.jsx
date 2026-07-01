"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Player } from "@remotion/player";
import {
  AlertCircle,
  ArrowLeft,
  Captions,
  ChevronLeft,
  Download,
  Loader2,
  Music,
  Pause,
  Play,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SeedanceReelComposition } from "@/lib/remotion/SeedanceReelComposition";
import { calcDurationInFrames, clampBrollClips } from "@/lib/remotion/duration";
import { EDITABLE_SOURCES } from "@/lib/editable-sources";
import { Timeline } from "@/modules/edit/components/timeline-ruler";

const FPS = 30;

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function CaptionsPanel() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Choose or generate captions for your reel. Each caption block will appear on the timeline as a clip.
      </p>
      <div className="rounded-xl border border-dashed border-border/60 py-10 flex flex-col items-center gap-2 text-center">
        <span className="text-sm font-medium text-muted-foreground">No captions yet</span>
        <span className="text-xs text-muted-foreground/60">Click below to add your first caption</span>
      </div>
      <button className="w-full rounded-xl border border-border/50 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
        + Add caption
      </button>
    </div>
  );
}

function PlaceholderPanel({ label }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-xs text-muted-foreground/60">Coming soon</span>
    </div>
  );
}

export function Editor({ compositionProps, onExit }) {
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState(null);
  const [activePanel, setActivePanel] = useState(null); // "captions" | "music" | "overlays" | null

  const playerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(0);

  const showIntro = false;
  const showOutro = false;
  const introTitle = "";
  const introSubtitle = "";
  const introTagline = "";
  const outroCtaText = compositionProps.ctaText || "";
  const outroBrandText = "thumbpin.ai";

  const sourceConfig = EDITABLE_SOURCES[compositionProps.source] || {};

  const handleDownload = async () => {
    setRendering(true);
    setRenderError(null);
    try {
      const renderProps = {
        ...compositionProps,
        brollClips: clampBrollClips({
          avatarDuration: compositionProps.avatarDuration,
          brollClips:     compositionProps.brollClips,
          ctaDuration:    compositionProps.ctaDuration,
          showIntro,
          showOutro,
        }),
        showIntro,
        showOutro,
        introTitle,
        introSubtitle,
        introTagline,
        outroBrandText,
        ctaText: outroCtaText,
      };
      const res = await fetch(sourceConfig.renderEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(renderProps),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || `Render failed: ${res.status}`);

      const filename = sourceConfig.downloadFilename || "video.mp4";
      const sep = data.url.includes("?") ? "&" : "?";
      const downloadUrl = `${data.url}${sep}download=1&filename=${filename}`;

      const a = document.createElement("a");
      a.href = downloadUrl;
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
    }
  };

  const clampedBrollClips = useMemo(() => clampBrollClips({
    avatarDuration: compositionProps.avatarDuration,
    brollClips:     compositionProps.brollClips,
    ctaDuration:    compositionProps.ctaDuration,
    showIntro,
    showOutro,
  }), [compositionProps.avatarDuration, compositionProps.brollClips, compositionProps.ctaDuration]);

  const previewProps = useMemo(() => ({
    ...compositionProps,
    brollClips: clampedBrollClips,
    showIntro,
    showOutro,
    introTitle,
    introSubtitle,
    introTagline,
    outroBrandText,
    ctaText: outroCtaText,
  }), [compositionProps, clampedBrollClips, outroCtaText]);

  const durationInFrames = useMemo(() => calcDurationInFrames({
    avatarDuration: compositionProps.avatarDuration,
    brollClips:     clampedBrollClips,
    ctaDuration:    compositionProps.ctaDuration,
    showIntro,
    showOutro,
  }), [compositionProps.avatarDuration, compositionProps.ctaDuration, clampedBrollClips]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onFrameUpdate = (e) => setFrame(e.detail.frame);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("frameupdate", onFrameUpdate);
    return () => {
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("frameupdate", onFrameUpdate);
    };
  }, []);

  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    if (playing) player.pause();
    else player.play();
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-12 z-10 bg-[#fafbfc] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-6 py-2 shrink-0 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onExit} className="gap-1.5 h-8 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Button>
          <div>
            <h1 className="text-base font-bold font-heading tracking-tight">Edit Reel</h1>
            <p className="text-xs text-muted-foreground truncate max-w-xs">{compositionProps.name || "Untitled reel"}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={handleDownload} disabled={rendering} className="gap-2 bg-linear-to-b from-black to-neutral-600 text-[#c7f038]">
            {rendering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Rendering…
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export
              </>
            )}
          </Button>
          {renderError && (
            <div className="flex items-start gap-1 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{renderError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Canvas + right panel */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Main canvas — video centered */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-4 px-6 bg-[#fafbfc]">
          <div className="rounded-2xl overflow-hidden border border-border/50 bg-black shadow-xl" style={{ aspectRatio: "9/16", height: "calc(100% - 2.5rem)", maxHeight: "100%" }}>
            <Player
              ref={playerRef}
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
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={togglePlay}
              className="h-7 w-7 rounded-full bg-neutral-900 text-white flex items-center justify-center hover:bg-neutral-800 transition-colors shrink-0"
            >
              {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
            </button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatTime(frame / FPS)} / {formatTime(durationInFrames / FPS)}
            </span>
          </div>
        </div>

        {/* Right panel — docked sidebar */}
        <div className="w-72 shrink-0 border-l border-border/50 bg-white flex flex-col overflow-hidden">
          {activePanel ? (
            <>
              <div className="flex items-center gap-2 px-3 py-3 border-b border-border/40 shrink-0">
                <button
                  onClick={() => setActivePanel(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold capitalize">{activePanel}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {activePanel === "captions" && <CaptionsPanel />}
                {activePanel === "music"    && <PlaceholderPanel label="Music" />}
                {activePanel === "overlays" && <PlaceholderPanel label="Text / Image Overlays" />}
              </div>
            </>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border/40 shrink-0">
                <span className="text-sm font-semibold">Edit</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                {[
                  { id: "captions", label: "Captions",              Icon: Captions, desc: "Add or edit captions" },
                  { id: "music",    label: "Music",                  Icon: Music,    desc: "Add background music" },
                  { id: "overlays", label: "Text / Image Overlays",  Icon: Type,     desc: "Add text or images" },
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
          onSeek={(f) => {
            setFrame(f);
            playerRef.current?.seekTo(f);
          }}
          onToolbarAction={(action) => {
            if (!action?.startsWith("add:")) return;
            const panel = action.slice(4);
            setActivePanel((prev) => (prev === panel ? null : panel));
          }}
        />
      </div>
    </div>
  );
}
