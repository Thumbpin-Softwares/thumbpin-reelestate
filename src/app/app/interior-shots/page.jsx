"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  X,
  ImageIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  ExternalLink,
  RotateCcw,
  Zap,
  ArrowLeft,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { compressImage } from "@/utils/compress-image";

const MAX_IMAGES = 6;
const MIN_IMAGES = 2;

const TIPS = [
  "Seedance 2.0 is weaving your photos into one seamless cinematic sequence…",
  "Crafting fluid camera motion through each room with no hard cuts…",
  "Applying consistent warm interior lighting across all spaces…",
  "Rendering hyper-realistic textures and premium finish details…",
  "Building smooth spatial transitions between each area…",
  "Adding cinematic depth and architectural elegance to every frame…",
];

export default function InteriorShotsPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [images, setImages]         = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const [status, setStatus]         = useState("idle"); // idle | generating | done | error
  const [statusMsg, setStatusMsg]   = useState("");
  const [videoUrl, setVideoUrl]     = useState(null);
  const [error, setError]           = useState(null);

  const [elapsed, setElapsed]       = useState(0);
  const [tipIndex, setTipIndex]     = useState(0);
  const elapsedRef                  = useRef(null);
  const tipRef                      = useRef(null);

  const addFiles = useCallback(async (files) => {
    const toAdd = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, MAX_IMAGES - images.length);

    if (!toAdd.length) return;

    const entries = await Promise.all(
      toAdd.map(async (file) => {
        const preview = URL.createObjectURL(file);
        return { file, preview, name: file.name };
      })
    );
    setImages((prev) => [...prev, ...entries].slice(0, MAX_IMAGES));
  }, [images.length]);

  const removeImage = (idx) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const startTimers = () => {
    setElapsed(0);
    setTipIndex(0);
    elapsedRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    tipRef.current     = setInterval(() => setTipIndex((i) => (i + 1) % TIPS.length), 4500);
  };

  const stopTimers = () => {
    clearInterval(elapsedRef.current);
    clearInterval(tipRef.current);
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const handleGenerate = async () => {
    if (images.length < MIN_IMAGES) {
      toast.error(`Upload at least ${MIN_IMAGES} interior images.`);
      return;
    }

    setStatus("generating");
    setError(null);
    setVideoUrl(null);
    startTimers();

    try {
      const formData = new FormData();
      for (let i = 0; i < images.length; i++) {
        try {
          const compressed = await compressImage(images[i].file);
          formData.append(`image_${i}`, compressed);
        } catch (_) {
          formData.append(`image_${i}`, images[i].file);
        }
      }

      const res = await fetch("/api/interior-shots/generate", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }
      if (!res.body) throw new Error("No response stream");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
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
              if (event.type === "generating" || event.type === "seedance_started") {
                setStatusMsg(event.message || "");
              } else if (event.type === "done") {
                stopTimers();
                setVideoUrl(event.videoUrl);
                setStatus("done");
                toast.success("Your interior walkthrough is ready!");
              } else if (event.type === "error") {
                throw new Error(event.message || "Generation failed");
              }
            } catch (parseErr) {
              if (parseErr.message !== "Generation failed" && !parseErr.message?.includes("JSON")) continue;
              throw parseErr;
            }
          }
        }
      }
    } catch (err) {
      stopTimers();
      console.error("[InteriorShots]", err);
      setStatus("error");
      setError(err.message || "Generation failed");
      toast.error("Generation failed", { description: err.message });
    }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `interior-walkthrough-${Date.now()}.mp4`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const reset = () => {
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
    setStatus("idle");
    setError(null);
    setVideoUrl(null);
    setStatusMsg("");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8 px-4">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold font-heading tracking-tight">Interior Shots</h1>
        <p className="text-sm text-neutral-500">
          Upload {MIN_IMAGES}–{MAX_IMAGES} interior photos → get a 15-second seamless cinematic walkthrough with no hard cuts.
        </p>
      </div>

      {/* IDLE / UPLOAD STATE */}
      {status === "idle" && (
        <div className="space-y-6">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => images.length < MAX_IMAGES && fileInputRef.current?.click()}
            className={`relative rounded-3xl border-2 border-dashed transition-all duration-300 cursor-pointer ${
              isDragging
                ? "border-[#c7f038] bg-[#c7f038]/5 scale-[1.01]"
                : images.length >= MAX_IMAGES
                ? "border-neutral-200 bg-neutral-50 cursor-not-allowed"
                : "border-neutral-200 bg-neutral-50 hover:border-neutral-400 hover:bg-white"
            }`}
          >
            {images.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white border border-neutral-200 shadow-sm flex items-center justify-center">
                  <Upload className="w-7 h-7 text-neutral-400" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-neutral-700">Drop interior photos here</p>
                  <p className="text-sm text-neutral-400 mt-1">or click to browse · up to {MAX_IMAGES} images · JPG, PNG, WEBP</p>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="grid grid-cols-3 gap-3">
                  {images.map((img, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden group">
                      <img
                        src={img.preview}
                        alt={img.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                      <button
                        onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div className="absolute bottom-1.5 left-1.5 bg-black/50 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                        {i + 1}
                      </div>
                    </div>
                  ))}

                  {/* Add more slot */}
                  {images.length < MAX_IMAGES && (
                    <div className="aspect-square rounded-xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center gap-1 text-neutral-400 hover:border-neutral-400 hover:text-neutral-600 transition-colors">
                      <ImageIcon className="w-5 h-5" />
                      <span className="text-[10px]">Add more</span>
                    </div>
                  )}
                </div>

                {/* Count indicator */}
                <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
                  <span>{images.length} of {MAX_IMAGES} images</span>
                  <span className={images.length >= MIN_IMAGES ? "text-emerald-600 font-medium" : "text-amber-500"}>
                    {images.length >= MIN_IMAGES ? "✓ Ready to generate" : `Add ${MIN_IMAGES - images.length} more to continue`}
                  </span>
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />

          {/* What you get */}
          <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4 space-y-3">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">What you&apos;ll get</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "15 seconds", sub: "seamless walkthrough" },
                { label: "No hard cuts", sub: "fluid transitions" },
                { label: "720p 9:16", sub: "ready for Reels" },
              ].map(({ label, sub }) => (
                <div key={label} className="space-y-0.5">
                  <p className="text-sm font-bold text-neutral-800">{label}</p>
                  <p className="text-[10px] text-neutral-400">{sub}</p>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={images.length < MIN_IMAGES}
            className="w-full h-12 gradient-bg text-white text-sm font-semibold rounded-2xl shadow-lg gap-2 disabled:opacity-40"
          >
            <Zap className="w-4 h-4" />
            Generate Interior Walkthrough
          </Button>
        </div>
      )}

      {/* GENERATING STATE */}
      {status === "generating" && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-violet-200/60 bg-violet-50/40 p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="relative shrink-0 mt-0.5">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-violet-600" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-violet-400/60 animate-ping" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-violet-800">Seedance 2.0 — Interior Walkthrough</p>
                <p className="text-xs text-violet-500 mt-0.5 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  Running for {formatTime(elapsed)} · typical: 4–8 minutes
                </p>
              </div>
              <div className="shrink-0 rounded-lg bg-violet-100 border border-violet-200/60 px-2.5 py-1 text-center min-w-14">
                <p className="text-base font-bold font-mono text-violet-700 tabular-nums">{formatTime(elapsed)}</p>
                <p className="text-[9px] text-violet-500 uppercase tracking-wide">elapsed</p>
              </div>
            </div>

            {/* Uploaded images preview */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <div key={i} className="shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 border-violet-200">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>

            {/* Animated tip */}
            <div className="rounded-xl bg-white/60 border border-violet-100 px-3 py-2.5 min-h-10">
              <p
                key={tipIndex}
                className="text-[11px] text-violet-700 leading-relaxed"
                style={{ animation: "fadeInUp 0.4s ease" }}
              >
                {TIPS[tipIndex]}
              </p>
            </div>

            {/* Dots */}
            <div className="flex items-center justify-center gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-violet-400"
                  style={{ animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite` }}
                />
              ))}
            </div>

            <p className="text-[10px] text-center text-violet-500/70">
              Do not close or refresh this tab — your generation will be lost.
            </p>
          </div>

          <style>{`
            @keyframes fadeInUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
            @keyframes bounce { 0%,80%,100%{ transform:scaleY(1); } 40%{ transform:scaleY(1.6); } }
          `}</style>
        </div>
      )}

      {/* ERROR STATE */}
      {status === "error" && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 space-y-3">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Generation failed</p>
              <p className="text-xs text-neutral-500 mt-1">{error}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={reset} className="gap-2 text-xs">
              <RotateCcw className="w-3.5 h-3.5" /> Try Again
            </Button>
          </div>
        </div>
      )}

      {/* DONE STATE */}
      {status === "done" && videoUrl && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
            <p className="text-sm font-semibold">Interior walkthrough ready!</p>
          </div>

          {/* Video preview */}
          <div className="rounded-3xl overflow-hidden border border-border/50 bg-black shadow-2xl max-w-xs mx-auto">
            <video
              src={videoUrl}
              controls
              loop
              playsInline
              className="w-full"
              style={{ aspectRatio: "9/16" }}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap justify-center">
            <Button onClick={handleDownload} className="gradient-bg text-white hover:opacity-90 shadow-lg gap-2 px-5">
              <Download className="w-4 h-4" />
              Download MP4
            </Button>
            <Button variant="outline" onClick={() => window.open(videoUrl, "_blank")} className="gap-2">
              <ExternalLink className="w-4 h-4" />
              Open in Tab
            </Button>
          </div>

          <div className="flex justify-center pt-2">
            <Button variant="ghost" onClick={reset} className="gap-2 text-neutral-500 text-sm">
              <RotateCcw className="w-4 h-4" />
              Create Another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
