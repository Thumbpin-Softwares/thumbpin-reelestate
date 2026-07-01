"use client";

import { useEffect, useRef, useState } from "react";
import { Player } from "@remotion/player";
import {
  ArrowLeft,
  Loader2,
  Download,
  AlertCircle,
  Pencil,
  Eye,
  ExternalLink,
  Video,
  Play,
  Pause,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SeedanceReelComposition } from "@/lib/remotion/SeedanceReelComposition";
import { calcDurationInFrames, clampBrollClips } from "@/lib/remotion/duration";
import {
  EDITABLE_SOURCES,
  COMPOSITION_STORAGE_KEY,
  buildCompositionFromAsset,
} from "@/lib/editable-sources";

export default function EditPage() {
  const [compositionProps, setCompositionProps] = useState(null);
  const [checkedStorage, setCheckedStorage] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(COMPOSITION_STORAGE_KEY);
      if (raw) setCompositionProps(JSON.parse(raw));
    } catch (_) {}
    setCheckedStorage(true);
  }, []);

  if (!checkedStorage) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (compositionProps) {
    return (
      <Editor
        compositionProps={compositionProps}
        onExit={() => {
          sessionStorage.removeItem(COMPOSITION_STORAGE_KEY);
          setCompositionProps(null);
        }}
      />
    );
  }

  return <VideoPicker onSelect={setCompositionProps} />;
}

// ─── Editor ───────────────────────────────────────────────────────────────
const FPS = 30;

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Editor({ compositionProps, onExit }) {
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState(null);

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
      console.error("[EditPage] Render failed:", err);
      setRenderError(err.message || "Render failed");
      toast.error("Render failed", { description: err.message });
    } finally {
      setRendering(false);
    }
  };

  const clampedBrollClips = clampBrollClips({
    avatarDuration: compositionProps.avatarDuration,
    brollClips:     compositionProps.brollClips,
    ctaDuration:    compositionProps.ctaDuration,
    showIntro,
    showOutro,
  });

  const previewProps = {
    ...compositionProps,
    brollClips: clampedBrollClips,
    showIntro,
    showOutro,
    introTitle,
    introSubtitle,
    introTagline,
    outroBrandText,
    ctaText: outroCtaText,
  };

  const durationInFrames = calcDurationInFrames({
    avatarDuration: compositionProps.avatarDuration,
    brollClips:     clampedBrollClips,
    ctaDuration:    compositionProps.ctaDuration,
    showIntro,
    showOutro,
  });

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

      {/* Preview — fills remaining space above timeline */}
      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden py-3">
        <div className="flex flex-col items-center gap-2 h-full">
          <div className="rounded-2xl overflow-hidden border border-border/50 bg-black shadow-xl flex-1 min-h-0" style={{ aspectRatio: "9/16" }}>
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

          <div className="flex items-center gap-2">
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
      </div>

      {/* Timeline — in flow at bottom */}
      <div className="shrink-0 px-6 pb-3 pt-2 bg-[#fafbfc] border-t border-border/50">
        <Timeline
          durationInFrames={durationInFrames}
          frame={frame}
          fps={FPS}
          onSeek={(f) => {
            setFrame(f);
            playerRef.current?.seekTo(f);
          }}
          onDownload={handleDownload}
          rendering={rendering}
        />
      </div>
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────
const TRACKS = [
  { id: "segments",      label: "Segments",      bar: "bg-neutral-800" },
  { id: "captions",      label: "Captions",      bar: "bg-[#c7f038]" },
  { id: "text-overlays", label: "Text Overlays", bar: "bg-neutral-300" },
];

function Timeline({ durationInFrames, frame, fps, onSeek, onDownload, rendering }) {
  const totalSeconds = durationInFrames / fps;
  const tickCount = Math.ceil(totalSeconds) + 1;
  const playheadPct = durationInFrames > 0 ? (frame / durationInFrames) * 100 : 0;
  const scrubRef = useRef(null);
  const dragging = useRef(false);

  const seekFromPointer = (e) => {
    const el = scrubRef.current;
    if (!el || durationInFrames === 0) return;
    const { left, width } = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - left) / width));
    onSeek(Math.round(ratio * (durationInFrames - 1)));
  };

  const onPointerDown = (e) => {
    dragging.current = true;
    scrubRef.current?.setPointerCapture(e.pointerId);
    seekFromPointer(e);
  };
  const onPointerMove = (e) => { if (dragging.current) seekFromPointer(e); };
  const onPointerUp   = () => { dragging.current = false; };

  return (
    <div className="w-full rounded-2xl border border-border/50 bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border/50 text-xs text-muted-foreground">
        <span className="cursor-pointer hover:text-foreground transition-colors">+ Add Text</span>
        <span className="text-border">|</span>
        <span className="cursor-pointer hover:text-foreground transition-colors">+ Add Image</span>
        <span className="text-border">|</span>
        <span>{TRACKS.length} tracks</span>
      </div>

      {/* Ruler + tracks */}
      <div className="flex">
        {/* Left labels column */}
        <div className="w-28 shrink-0 border-r border-border/50">
          <div className="h-6 border-b border-border/40 bg-muted/30" />
          {TRACKS.map((track) => (
            <div
              key={track.id}
              className="h-9 flex items-center px-3 border-b border-border/40 text-[11px] text-muted-foreground font-medium truncate"
            >
              {track.label}
            </div>
          ))}
        </div>

        {/* Scrubable timeline area */}
        <div
          ref={scrubRef}
          className="flex-1 overflow-x-auto relative cursor-col-resize select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* Time ruler */}
          <div className="relative h-6 border-b border-border/40 bg-muted/30">
            {Array.from({ length: tickCount }).map((_, i) => {
              const isMajor = i % 5 === 0;
              const pct = (i / Math.max(totalSeconds, 1)) * 100;
              return (
                <div
                  key={i}
                  className="absolute top-0 h-full flex flex-col items-start"
                  style={{ left: `${pct}%` }}
                >
                  <div className={`w-px ${isMajor ? "h-3 bg-border" : "h-1.5 bg-border/40"}`} />
                  {isMajor && (
                    <span className="text-[9px] text-muted-foreground ml-1 tabular-nums whitespace-nowrap">
                      {i === 0 ? "0:00" : `${Math.floor(i / 60)}:${String(i % 60).padStart(2, "0")}`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Track rows */}
          {TRACKS.map((track) => (
            <div key={track.id} className="relative h-9 border-b border-border/40 bg-white">
              <div
                className={`absolute inset-y-2 left-0.5 right-0.5 rounded-md ${track.bar} flex items-center px-2.5`}
              >
                <span className={`text-[10px] font-medium truncate ${track.id === "captions" ? "text-neutral-800" : track.id === "text-overlays" ? "text-neutral-500" : "text-white"}`}>
                  {track.label}
                </span>
              </div>
            </div>
          ))}

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-px bg-neutral-900 z-10 pointer-events-none"
            style={{ left: `${playheadPct}%` }}
          >
            <div className="w-3 h-3 bg-neutral-900 rounded-full -translate-x-[5px] -translate-y-px" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Video Picker ─────────────────────────────────────────────────────────
function VideoPicker({ onSelect }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [previewVideo, setPreviewVideo] = useState(null);
  const [selectingId, setSelectingId] = useState(null);

  async function fetchVideos(page = 1) {
    setLoading(true);
    try {
      const res = await fetch(`/api/user/videos?page=${page}&limit=12`);
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || []);
        setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
      }
    } catch (err) {
      console.error("Failed to fetch videos:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchVideos();
  }, []);

  async function handleEditClick(video) {
    if (selectingId) return;
    setSelectingId(video.id);
    try {
      const compositionProps = await buildCompositionFromAsset(video);
      if (!compositionProps) return;
      sessionStorage.setItem(COMPOSITION_STORAGE_KEY, JSON.stringify(compositionProps));
      onSelect(compositionProps);
    } finally {
      setSelectingId(null);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pt-12 bg-[#fafbfc]">
      <div>
        <h1 className="text-2xl font-semibold font-heading tracking-tight">Edit a video</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a video below to open it in the editor
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && videos.length === 0 && (
        <Card className="border border-dashed border-border/60">
          <CardContent className="py-16 text-center">
            <Video className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No videos yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Generate your first video to see it here
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && videos.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {videos.map((video) => {
            const canEdit = !!EDITABLE_SOURCES[video.metadata?.source];
            return (
              <Card
                key={video.id}
                className="group overflow-hidden border-border/50 bg-card hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <CardContent className="p-0">
                  <div className="relative aspect-video overflow-hidden bg-muted">
                    {video.url ? (
                      <video
                        src={video.url}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        preload="metadata"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-10 h-10 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    {video.url && (
                      <button
                        onClick={() => setPreviewVideo(video)}
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <div className="h-12 w-12 rounded-full bg-white/90 backdrop-blur flex items-center justify-center">
                          <Eye className="w-5 h-5 text-black" />
                        </div>
                      </button>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="font-medium text-sm line-clamp-1">{video.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(video.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <Badge variant="secondary" className="text-[11px]">
                        {canEdit ? "Editable" : video.type}
                      </Badge>

                      {canEdit ? (
                        <Button
                          size="sm"
                          className="gap-2 bg-neutral-900 text-[#c7f038]"
                          disabled={selectingId === video.id}
                          onClick={() => handleEditClick(video)}
                        >
                          {selectingId === video.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Pencil className="w-3.5 h-3.5" />
                          )}
                          Edit
                        </Button>
                      ) : (
                        video.url && (
                          <a href={video.url} download>
                            <Button variant="outline" size="sm" className="gap-2">
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </Button>
                          </a>
                        )
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Preview dialog for non-editable / quick-preview clicks */}
      <Dialog open={!!previewVideo} onOpenChange={() => setPreviewVideo(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-base font-semibold truncate pr-6">
              {previewVideo?.name || "Preview"}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-3">
            {previewVideo?.url && (
              <div className="w-full rounded-xl overflow-hidden bg-black">
                <video
                  src={previewVideo.url}
                  controls
                  autoPlay
                  className="w-full max-h-[70vh] object-contain"
                />
              </div>
            )}
            {previewVideo?.url && (
              <div className="flex gap-2 mt-3 justify-end">
                <a href={previewVideo.url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="text-xs cursor-pointer gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" /> Open
                  </Button>
                </a>
                <a href={previewVideo.url} download={previewVideo.name}>
                  <Button size="sm" className="text-xs cursor-pointer gap-1.5 gradient-bg text-white">
                    <Download className="w-3.5 h-3.5" /> Download
                  </Button>
                </a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer h-8 text-xs"
            disabled={pagination.page <= 1}
            onClick={() => fetchVideos(pagination.page - 1)}
          >
            Previous
          </Button>
          <Badge variant="secondary" className="text-xs">
            Page {pagination.page} of {pagination.totalPages}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer h-8 text-xs"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchVideos(pagination.page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
