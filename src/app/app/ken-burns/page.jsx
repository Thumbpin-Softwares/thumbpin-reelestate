"use client";

import { useState, useCallback, useRef } from "react";
import {
  X, Download, Loader2, Film, ChevronLeft, ImagePlus,
  Play, Pause, RotateCcw, CheckCircle2, AlertCircle,
  Sparkles, ScanLine,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateKenBurnsVideo } from "@/lib/ken-burns";
import { uploadCombinedVideo } from "@/lib/video-combiner";

const MAX_PHOTOS = 6;

const LABEL_COLOR = {
  "Bedroom":         "bg-violet-500/80",
  "Kitchen":         "bg-orange-500/80",
  "Living Room":     "bg-blue-500/80",
  "Bathroom":        "bg-cyan-500/80",
  "Dining Room":     "bg-amber-500/80",
  "Balcony/Terrace": "bg-teal-500/80",
  "Lobby/Entrance":  "bg-indigo-500/80",
  "Study/Office":    "bg-slate-500/80",
  "Exterior":        "bg-red-500/80",
  "Other":           "bg-zinc-500/80",
};

export default function KenBurnsPage() {
  const [photos, setPhotos]               = useState([]);
  const [dragging, setDragging]           = useState(false);
  const [classifications, setClassifications] = useState([]);
  const [progressMsg, setProgressMsg]     = useState("");
  const [status, setStatus]               = useState("idle"); // idle|classifying|classified|generating|done|error
  const [error, setError]                 = useState(null);
  const [videoUrl, setVideoUrl]           = useState(null);
  const [isPlaying, setIsPlaying]         = useState(false);
  const videoRef = useRef(null);

  // ── Photo upload ──────────────────────────────────────────────────────────
  const addPhotos = useCallback((files) => {
    const valid = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!valid.length) { toast.error("Please upload image files."); return; }
    const slots = MAX_PHOTOS - photos.length;
    if (slots <= 0) { toast.error(`Max ${MAX_PHOTOS} photos.`); return; }
    setPhotos((prev) => [
      ...prev,
      ...valid.slice(0, slots).map((f) => ({
        file: f, url: URL.createObjectURL(f), name: f.name,
      })),
    ]);
    setClassifications([]);
    setStatus("idle");
    setVideoUrl(null);
    setError(null);
  }, [photos.length]);

  const removePhoto = (idx) => {
    setPhotos((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx].url);
      next.splice(idx, 1);
      return next;
    });
    setClassifications([]);
    if (status !== "idle") setStatus("idle");
  };

  // ── Step 1: Classify with Gemini ─────────────────────────────────────────
  const classify = async () => {
    if (!photos.length) { toast.error("Upload photos first."); return; }
    setStatus("classifying");
    setClassifications([]);
    setError(null);

    const fd = new FormData();
    photos.forEach((p) => fd.append("images", p.file));

    try {
      const res = await fetch("/api/ken-burns/classify", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Classification failed");
      setClassifications(data.results || []);
      setStatus("classified");

      const exteriorCount = (data.results || []).filter((r) => r.isExterior).length;
      const interiorCount = photos.length - exteriorCount;
      if (interiorCount === 0) {
        toast.warning("All photos are exterior shots — no interior rooms to animate.");
      } else {
        toast.success(`Scanned ${photos.length} photos · ${interiorCount} interior, ${exteriorCount} exterior skipped`);
      }
    } catch (err) {
      setError(err.message);
      setStatus("error");
      toast.error("Scan failed", { description: err.message });
    }
  };

  // ── Step 2: Ken Burns animation (browser FFmpeg WASM) ────────────────────
  const generate = async () => {
    const interior = classifications.filter((c) => !c.isExterior);
    if (!interior.length) { toast.error("No interior photos to animate."); return; }

    setStatus("generating");
    setError(null);
    setVideoUrl(null);
    setProgressMsg("Loading FFmpeg engine…");

    try {
      const items = interior.map((c) => ({
        type: "photo",
        file: photos[c.index].file,
        name: photos[c.index].name,
      }));

      const { blob } = await generateKenBurnsVideo(items, {
        durationPerPhoto: 5,
        fadeDuration: 0.5,
        onProgress: (msg) => setProgressMsg(msg),
      });

      setProgressMsg("Uploading reel…");

      let finalUrl = URL.createObjectURL(blob);
      try {
        const { url } = await uploadCombinedVideo(blob, `ken-burns-reel-${Date.now()}.mp4`);
        finalUrl = url;
      } catch {}

      setVideoUrl(finalUrl);
      setStatus("done");
      toast.success("Reel ready!");
    } catch (err) {
      setError(err.message);
      setStatus("error");
      toast.error("Generation failed", { description: err.message });
    }
  };

  const reset = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setClassifications([]);
    setVideoUrl(null);
    setStatus("idle");
    setError(null);
    setIsPlaying(false);
    setProgressMsg("");
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `ken-burns-reel-${Date.now()}.mp4`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getClassification = (idx) => classifications.find((c) => c.index === idx);
  const interiorCount = classifications.filter((c) => !c.isExterior).length;
  const isGenerating = status === "classifying" || status === "generating";

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-xl mx-auto space-y-6 animate-fade-in">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/app/veo-long-ad"
            className="w-8 h-8 rounded-xl border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold font-heading tracking-tight flex items-center gap-2">
              <Film className="w-5 h-5 text-primary" />
              Property Reel
            </h1>
            <p className="text-xs text-muted-foreground">
              Gemini scans rooms · Ken Burns animation · auto-combine
            </p>
          </div>
        </div>

        {/* ── Done ─────────────────────────────────────────────────────────── */}
        {status === "done" && videoUrl ? (
          <div className="space-y-4">
            <div className="relative rounded-3xl overflow-hidden border border-border/50 bg-black aspect-[9/16] max-w-xs mx-auto shadow-2xl">
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                loop
                playsInline
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              <button
                onClick={() => {
                  if (!videoRef.current) return;
                  isPlaying ? videoRef.current.pause() : videoRef.current.play();
                }}
                className="absolute inset-0 flex items-center justify-center group"
              >
                <div className={`w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition-opacity ${isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"}`}>
                  {isPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white ml-1" />}
                </div>
              </button>
            </div>
            <div className="flex gap-2 justify-center flex-wrap">
              <Button onClick={handleDownload} className="gradient-bg text-white hover:opacity-90 shadow-lg gap-2 px-5">
                <Download className="w-4 h-4" /> Download Reel
              </Button>
              <Button variant="outline" onClick={reset} className="gap-2">
                <RotateCcw className="w-4 h-4" /> New Reel
              </Button>
            </div>
            <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Saved to Asset Library
            </p>
          </div>
        ) : (
          <>
            {/* ── Photo upload ──────────────────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Property Photos</p>
                <span className="text-xs text-muted-foreground">{photos.length}/{MAX_PHOTOS}</span>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); addPhotos(e.dataTransfer.files); }}
                className={`border-2 border-dashed rounded-3xl transition-all ${
                  dragging
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : photos.length === 0
                    ? "border-border hover:border-primary/50 bg-muted/20"
                    : "border-border/40 bg-muted/10"
                }`}
              >
                {photos.length === 0 ? (
                  <label className="flex flex-col items-center gap-3 py-10 cursor-pointer">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <ImagePlus className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">Drop photos or click to upload</p>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP · up to {MAX_PHOTOS}</p>
                    </div>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => addPhotos(e.target.files)} />
                  </label>
                ) : (
                  <div className="p-3">
                    <div className="grid grid-cols-4 gap-2">
                      {photos.map((img, idx) => {
                        const cls = getClassification(idx);
                        return (
                          <div
                            key={idx}
                            className={`relative group aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                              cls?.isExterior
                                ? "border-red-400/60 opacity-50"
                                : cls
                                ? "border-primary/40"
                                : "border-border/30"
                            }`}
                          >
                            <img src={img.url} alt={img.name} className="w-full h-full object-cover" />

                            {cls && (
                              <div className={`absolute bottom-0 left-0 right-0 px-1 py-0.5 text-[7px] font-semibold text-white text-center ${LABEL_COLOR[cls.label] ?? "bg-zinc-500/80"}`}>
                                {cls.isExterior ? "SKIP" : cls.label.toUpperCase()}
                              </div>
                            )}

                            <button
                              onClick={() => removePhoto(idx)}
                              disabled={isGenerating}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                      {photos.length < MAX_PHOTOS && (
                        <label className="aspect-square rounded-xl border-2 border-dashed border-border/50 flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
                          <ImagePlus className="w-4 h-4 text-muted-foreground" />
                          <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => addPhotos(e.target.files)} />
                        </label>
                      )}
                    </div>

                    {classifications.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {interiorCount} interior · {classifications.filter((c) => c.isExterior).length} exterior skipped
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Classify CTA ─────────────────────────────────────────────── */}
            {photos.length > 0 && status === "idle" && (
              <Button onClick={classify} variant="outline" className="w-full gap-2 h-10">
                <ScanLine className="w-4 h-4" />
                Scan Rooms with Gemini
              </Button>
            )}

            {/* ── Classifying spinner ───────────────────────────────────────── */}
            {status === "classifying" && (
              <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/20 p-4">
                <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Scanning rooms…</p>
                  <p className="text-xs text-muted-foreground">Gemini Vision is classifying each photo</p>
                </div>
              </div>
            )}

            {/* ── Generate CTA ─────────────────────────────────────────────── */}
            {status === "classified" && interiorCount > 0 && (
              <Button
                onClick={generate}
                className="w-full gradient-bg text-white hover:opacity-90 shadow-lg gap-2 h-11"
              >
                <Sparkles className="w-4 h-4" />
                Animate {interiorCount} Room{interiorCount !== 1 ? "s" : ""} with Ken Burns
              </Button>
            )}

            {/* ── Generation progress ───────────────────────────────────────── */}
            {status === "generating" && (
              <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-muted/20 p-4">
                <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Generating reel…</p>
                  {progressMsg && (
                    <p className="text-xs text-muted-foreground">{progressMsg}</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Error ───────────────────────────────────────────────────────── */}
            {status === "error" && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Something went wrong</p>
                  <p className="text-xs text-muted-foreground mt-1">{error}</p>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => setStatus(classifications.length ? "classified" : "idle")}
                    className="mt-3 gap-1.5 text-xs"
                  >
                    <RotateCcw className="w-3 h-3" /> Try Again
                  </Button>
                </div>
              </div>
            )}

            {photos.length === 0 && (
              <p className="text-center text-xs text-muted-foreground">
                Upload property photos to get started
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
