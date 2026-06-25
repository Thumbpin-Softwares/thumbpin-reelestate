"use client";

import { useEffect, useState } from "react";
import { Player } from "@remotion/player";
import {
  Plus,
  ArrowLeft,
  Loader2,
  Download,
  AlertCircle,
  Pencil,
  Eye,
  ExternalLink,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
function Editor({ compositionProps, onExit }) {
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState(null);

  const [showIntro, setShowIntro] = useState(false);
  const [showOutro, setShowOutro] = useState(false);
  const [introTitle, setIntroTitle] = useState("Luxury");
  const [introSubtitle, setIntroSubtitle] = useState("Living");
  const [introTagline, setIntroTagline] = useState("Where Every Detail Matters");
  const [outroCtaText, setOutroCtaText] = useState(compositionProps.ctaText || "");
  const [outroBrandText, setOutroBrandText] = useState("thumbpin.ai");

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

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="sm" onClick={onExit} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Edit Reel</h1>
          <p className="text-sm text-muted-foreground">Preview your reel and add optional clips at the start or end</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
        {/* Preview column */}
        <div className="flex flex-col items-center gap-3 w-full max-w-xs mx-auto lg:mx-0">
          <AddSlot label="Add intro clip" />

          <div className="w-full rounded-3xl overflow-hidden border border-border/50 bg-black shadow-2xl">
            <Player
              component={SeedanceReelComposition}
              inputProps={previewProps}
              durationInFrames={durationInFrames}
              compositionWidth={1080}
              compositionHeight={1920}
              fps={30}
              style={{ width: "100%", aspectRatio: "9/16" }}
              controls
              loop
              clickToPlay
            />
          </div>

          <AddSlot label="Add outro clip" />
        </div>

        {/* Controls column */}
        <div className="flex-1 w-full lg:max-w-sm space-y-4">
          <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Intro title card</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Optional white title card before the reel starts.
                </p>
              </div>
              <Switch checked={showIntro} onCheckedChange={setShowIntro} />
            </div>
            {showIntro && (
              <div className="space-y-2.5 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="intro-title" className="text-xs">Title</Label>
                  <Input id="intro-title" value={introTitle} onChange={(e) => setIntroTitle(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="intro-subtitle" className="text-xs">Subtitle</Label>
                  <Input id="intro-subtitle" value={introSubtitle} onChange={(e) => setIntroSubtitle(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="intro-tagline" className="text-xs">Tagline</Label>
                  <Input id="intro-tagline" value={introTagline} onChange={(e) => setIntroTagline(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Outro title card</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Optional white CTA card after the reel ends.
                </p>
              </div>
              <Switch checked={showOutro} onCheckedChange={setShowOutro} />
            </div>
            {showOutro && (
              <div className="space-y-2.5 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="outro-cta" className="text-xs">CTA text</Label>
                  <Textarea id="outro-cta" value={outroCtaText} onChange={(e) => setOutroCtaText(e.target.value)} rows={3} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="outro-brand" className="text-xs">Brand text</Label>
                  <Input id="outro-brand" value={outroBrandText} onChange={(e) => setOutroBrandText(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Download reel</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Renders the final MP4 with Remotion — takes 1–3 minutes.
              </p>
            </div>
            <Button onClick={handleDownload} disabled={rendering} className="w-full gap-2">
              {rendering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Rendering…
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download MP4
                </>
              )}
            </Button>
            {renderError && (
              <div className="flex items-start gap-2 text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{renderError}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddSlot({ label }) {
  return (
    <button className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all py-3 px-4 text-sm text-muted-foreground hover:text-primary group">
      <div className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center group-hover:bg-primary group-hover:border-primary group-hover:text-white transition-all">
        <Plus className="w-3.5 h-3.5" />
      </div>
      {label}
    </button>
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
