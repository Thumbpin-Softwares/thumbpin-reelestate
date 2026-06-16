"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Clapperboard,
  Download,
  RotateCcw,
  ExternalLink,
  Play,
  Pause,
  FileEdit,
  Mic,
  Video,
  User,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { compressImage, compressBlob } from "@/utils/compress-image";
import { combineVideos, uploadCombinedVideo } from "@/lib/video-combiner";

const STATUS = {
  IDLE: "idle",
  AWAITING_APPROVAL: "awaiting_approval",
  VOICE_GENERATING: "voice_generating",
  GENERATING_BASE: "generating_base",
  EXTENDING: "extending",
  COMBINING: "combining",
  UPLOADING: "uploading",
  DONE: "done",
  ERROR: "error",
};

const BEAT_COLORS = {
  HOOK: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  AVATAR_SEGMENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  PROPERTY_VISUAL: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  FEATURE_BURST: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  CTA: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

/**
 * GenerationProgress — Step 3 of the Long-Form Veo Ad pipeline.
 *
 * Receives `generationParams` from the parent and kicks off the
 * SSE stream to /api/veo-long-ad/generate-pipeline.
 *
 * Props:
 *   generationParams: { chunks, masterVoicePrompt, language, locationImages, avatarImages }
 *   onReset: () => void — go back to step 0
 */
export function GenerationProgress({ generationParams, onReset }) {
  const {
    beats = [],
    chunks = [],
    masterVoicePrompt = "",
    voiceProfile = "",
    presenterDescription = "",
    language = "english",
    elevenLabsVoice = "21m00Tcm4TlvDq8ikWAM",
    backgroundImage = null,
    locationImages = [],
    avatarImages = [],
  } = generationParams || {};

  // Prefer beats array; fall back to legacy chunks
  const beatPlan = beats.length > 0 ? beats : chunks;

  const [status, setStatus] = useState(STATUS.IDLE);
  const [currentChunkIdx, setCurrentChunkIdx] = useState(-1);
  const [completedChunks, setCompletedChunks] = useState([]);
  const [chunkClipUrls, setChunkClipUrls] = useState({});
  const [message, setMessage] = useState("");
  const [videoUrl, setVideoUrl] = useState(null);
  const [combineProgress, setCombineProgress] = useState("");
  const [totalDuration, setTotalDuration] = useState(0);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Script approval state
  const [pendingJobId, setPendingJobId] = useState(null);
  const [editedChunks, setEditedChunks] = useState([]);
  const [editedVoicePrompt, setEditedVoicePrompt] = useState("");
  const [pendingPresenterDesc, setPendingPresenterDesc] = useState("");
  const [approvalCountdown, setApprovalCountdown] = useState(10);

  const videoRef = useRef(null);
  const hasStarted = useRef(false);
  const countdownRef = useRef(null);
  const pendingClipUrls = useRef(null);

  const totalChunks = beatPlan.length;

  // ── Auto-start SSE pipeline on mount ─────────────────────────────────────
  useEffect(() => {
    if (hasStarted.current || !beatPlan.length) return;
    hasStarted.current = true;
    startPipeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const triggerCombine = async (clipUrls, audioUrls, fullAudioUrl, serverDurations) => {
    if (!clipUrls || clipUrls.length === 0) return;
    setStatus(STATUS.COMBINING);
    setCombineProgress("Loading FFmpeg…");

    const hasAudio = !!(fullAudioUrl || audioUrls?.some(Boolean));
    if (!hasAudio) {
      console.warn("[GenerationProgress] No audio URL received — video will be silent.");
      toast.warning("No audio generated — video will be silent. Check server logs for TTS errors.", { duration: 8000 });
    } else {
      console.log("[GenerationProgress] fullAudioUrl:", fullAudioUrl);
    }

    try {
      const durations = serverDurations || beatPlan.map((b) => b.duration_seconds || b.estimatedSeconds || null);
      const { blobUrl, blob } = await combineVideos(clipUrls, {
        onProgress: (msg) => setCombineProgress(msg),
        durations,
        audioUrls: fullAudioUrl ? null : (audioUrls || null),
        fullAudioUrl: fullAudioUrl || null,
      });

      // Upload to R2 so the URL is permanent and shareable on any platform
      setCombineProgress("Saving final reel…");
      try {
        const { url: r2Url } = await uploadCombinedVideo(blob, `hybrid-reel-${Date.now()}.mp4`);
        setVideoUrl(r2Url);
      } catch {
        setVideoUrl(blobUrl);
      }

      setStatus(STATUS.DONE);
      toast.success("🎬 Reel assembled! Ready to download.");
    } catch (err) {
      console.error("[GenerationProgress] Combine failed:", err);
      setVideoUrl(clipUrls[0]);
      setStatus(STATUS.DONE);
      toast.warning("Could not auto-combine clips — showing first clip.");
    }
  };

  const startPipeline = async () => {
    setStatus(STATUS.IDLE);
    setCurrentChunkIdx(0);
    setCompletedChunks([]);
    setVideoUrl(null);
    pendingClipUrls.current = null;
    setError(null);
    setMessage("Starting generation pipeline…");

    try {
      const formData = new FormData();
      // Send beats (new format) + chunks (legacy fallback)
      if (beats.length > 0) formData.append("beats", JSON.stringify(beats));
      formData.append("chunks", JSON.stringify(chunks));
      formData.append("voiceProfile", voiceProfile || masterVoicePrompt);
      formData.append("masterVoicePrompt", voiceProfile || masterVoicePrompt);
      formData.append("presenterDescription", presenterDescription);
      formData.append("language", language);
      formData.append("elevenLabsVoice", elevenLabsVoice);
      formData.append("aspectRatio", "9:16");

      await Promise.all(
        locationImages.slice(0, 5).map(async (img, i) => {
          if (!img.file) return;
          const compressed = await compressImage(img.file);
          formData.append(`locationImage_${i}`, compressed);
        })
      );

      // Avatar images: prebuilt avatars have file=null but a valid URL.
      // Fetch those URLs and convert to Blob so the backend receives them.
      await Promise.all(
        avatarImages.slice(0, 3).map(async (av, i) => {
          if (av.file) {
            const compressed = await compressImage(av.file);
            formData.append(`avatarImage_${i}`, compressed);
          } else if (av.url) {
            try {
              const resp = await fetch(av.url);
              if (resp.ok) {
                const blob = await resp.blob();
                const compressed = await compressBlob(blob);
                formData.append(`avatarImage_${i}`, compressed);
              }
            } catch (_) {
              console.warn(`[GenerationProgress] Could not fetch avatar ${i} from URL:`, av.url);
            }
          }
        })
      );

      if (backgroundImage?.file) {
        const compressed = await compressImage(backgroundImage.file);
        formData.append("backgroundImage", compressed);
      }

      const res = await fetch("/api/veo-long-ad/generate-pipeline", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to start pipeline");
      }
      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events are delimited by double newline "\n\n"
        const events = buffer.split("\n\n");
        // Keep the last incomplete chunk in the buffer
        buffer = events.pop() ?? "";

        for (const eventBlock of events) {
          // Each block may have multiple lines; find the "data:" line
          for (const line of eventBlock.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              handleEvent(event);
            } catch (_) {}
          }
        }
      }
    } catch (err) {
      console.error("[GenerationProgress] Error:", err);
      setStatus(STATUS.ERROR);
      setError(err.message || "Pipeline failed");
      toast.error("Generation failed", { description: err.message });
    }
  };

  const handleEvent = (event) => {
    switch (event.type) {
      case "script_requires_approval":
        setPendingJobId(event.jobId);
        setEditedChunks(event.chunks.map((c) => ({ ...c })));
        setEditedVoicePrompt(event.masterVoicePrompt || "");
        setPendingPresenterDesc(event.presenterDescription || "");
        setApprovalCountdown(10);
        setStatus(STATUS.AWAITING_APPROVAL);
        setMessage(event.message || "");

        countdownRef.current = setInterval(() => {
          setApprovalCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(countdownRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        break;

      case "script_approved":
      case "beat_plan_approved":
        clearInterval(countdownRef.current);
        setStatus(STATUS.GENERATING_BASE);
        setMessage(event.message || "Starting generation…");
        break;

      case "voice_generating":
        setStatus(STATUS.VOICE_GENERATING);
        setMessage(event.message || `Generating voice for ${event.avatarBeatCount ?? ""} avatar beat(s)…`);
        break;

      case "voice_ready":
        setStatus(STATUS.GENERATING_BASE);
        setMessage(event.message || "Voice ready. Starting video generation…");
        break;

      case "voice_warning":
        toast.warning(event.message || "Voice generation issue", { duration: 8000 });
        setMessage(event.message || "");
        break;

      case "beat_generating":
        setCurrentChunkIdx(event.beatIndex ?? event.chunkIndex ?? 0);
        setMessage(event.message || "");
        setStatus(STATUS.GENERATING_BASE);
        break;

      case "beat_done": {
        const idx = event.beatIndex ?? event.chunkIndex ?? 0;
        setCurrentChunkIdx(idx);
        setCompletedChunks((prev) => [...new Set([...prev, idx])]);
        if (event.clipUrl) {
          setChunkClipUrls((prev) => ({ ...prev, [idx]: event.clipUrl }));
        }
        setMessage(event.message || "");
        break;
      }

      case "progress":
        setCurrentChunkIdx(event.chunkIndex ?? 0);
        setMessage(event.message || "");
        if (event.status === "generating" || event.status === "rendering") setStatus(STATUS.GENERATING_BASE);
        else if (event.status === "extending") setStatus(STATUS.EXTENDING);
        break;

      case "chunk_done": {
        const idx = event.chunkIndex ?? 0;
        setCurrentChunkIdx(idx);
        setCompletedChunks((prev) => [...new Set([...prev, idx])]);
        if (event.clipUrl) {
          setChunkClipUrls((prev) => ({ ...prev, [idx]: event.clipUrl }));
        }
        setMessage(event.message || "");
        break;
      }

      case "uploading":
        setStatus(STATUS.UPLOADING);
        setMessage(event.message || "Saving…");
        break;

      case "video_ready":
        setTotalDuration(event.totalDuration || 0);
        setMessage(event.message || "");
        setCompletedChunks(beatPlan.map((_, i) => i));
        if (!event.clipUrls || event.clipUrls.length === 0) {
          setStatus(STATUS.ERROR);
          setError("No clips were generated. Check server logs for Veo errors.");
          toast.error("Generation failed — no clips produced. Check the server console.");
        } else {
          toast.success(`${event.clipUrls.length} clips ready — combining with voiceover…`);
          triggerCombine(event.clipUrls, event.audioUrls || null, event.fullAudioUrl || null, event.durations || null);
        }
        break;

      case "error":
        if (event.partial) {
          toast.warning(`Extension stopped at chunk ${(event.failedChunkIndex ?? 0) + 1}. Saving partial video.`, {
            duration: 6000,
          });
        } else {
          setStatus(STATUS.ERROR);
          setError(event.message || "Generation failed");
          toast.error("Pipeline error", { description: event.message });
        }
        break;

      case "done":
        if (status !== STATUS.DONE) setStatus(STATUS.DONE);
        break;

      default:
        break;
    }
  };

  const handleApprove = async () => {
    if (!pendingJobId) return;
    clearInterval(countdownRef.current);

    try {
      const res = await fetch("/api/veo-long-ad/approve-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: pendingJobId,
          chunks: editedChunks,
          masterVoicePrompt: editedVoicePrompt,
          presenterDescription: pendingPresenterDesc,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to approve");
      }
    } catch (err) {
      toast.error("Approval failed", { description: err.message });
    }
  };

  const updateChunkPrompt = (idx, veoPrompt) => {
    setEditedChunks((prev) => prev.map((c, i) => (i === idx ? { ...c, veoPrompt } : c)));
  };

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `long-form-ad-${Date.now()}.mp4`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ── Beat status helpers ───────────────────────────────────────────────────
  const getBeatStatus = (idx) => {
    if (completedChunks.includes(idx)) return "done";
    if (idx === currentChunkIdx) return "active";
    return "waiting";
  };

  const progressPercent = totalChunks > 0
    ? Math.round((completedChunks.length / totalChunks) * 100)
    : 0;

  // ── Status label ─────────────────────────────────────────────────────────
  const statusLabel = () => {
    if (status === STATUS.AWAITING_APPROVAL) return `Review beat plan — auto-approving in ${approvalCountdown}s`;
    if (status === STATUS.VOICE_GENERATING) return "Generating ElevenLabs voice…";
    if (status === STATUS.GENERATING_BASE) return `Generating beat ${currentChunkIdx + 1}/${totalChunks}…`;
    if (status === STATUS.EXTENDING) return `Generating beat ${currentChunkIdx + 1}/${totalChunks}…`;
    if (status === STATUS.COMBINING) return "Assembling clips…";
    if (status === STATUS.UPLOADING) return "Saving to Asset Library…";
    if (status === STATUS.DONE) return "Done!";
    if (status === STATUS.ERROR) return "Error";
    return "Starting…";
  };

  const isGenerating = [STATUS.VOICE_GENERATING, STATUS.GENERATING_BASE, STATUS.EXTENDING, STATUS.UPLOADING, STATUS.COMBINING].includes(status);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold font-heading tracking-tight">
          {status === STATUS.DONE
            ? "🎬 Your Hybrid Reel is Ready!"
            : status === STATUS.AWAITING_APPROVAL
            ? "Review Your Beat Plan"
            : status === STATUS.COMBINING
            ? "Assembling Clips…"
            : "Generating Hybrid Reel"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {status === STATUS.DONE
            ? `${totalDuration}s reel — saved to your Asset Library`
            : status === STATUS.AWAITING_APPROVAL
            ? "Edit narration or Veo prompts below. Auto-approves in a few seconds."
            : status === STATUS.COMBINING
            ? combineProgress || "Combining clips with FFmpeg…"
            : `${totalChunks} beats · Ken Burns + ElevenLabs TTS · avatar acts = black screen`}
        </p>
      </div>

      {/* ── Script Approval Panel ─────────────────────────────────────────── */}
      {status === STATUS.AWAITING_APPROVAL && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileEdit className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Script Ready — Review & Approve</span>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-colors ${
              approvalCountdown <= 3
                ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                : "bg-primary/10 text-primary"
            }`}>
              {approvalCountdown}s
            </span>
          </div>

          {/* Voice Profile */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Voice Profile
            </label>
            <textarea
              value={editedVoicePrompt}
              onChange={(e) => setEditedVoicePrompt(e.target.value)}
              rows={3}
              className="w-full text-xs rounded-xl border border-border/50 bg-background/80 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>

          {/* Chunk editors */}
          <div className="space-y-3">
            {editedChunks.map((chunk, i) => (
              <div key={i} className="rounded-xl border border-border/40 bg-background/60 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
                    Scene {i + 1}
                  </span>
                  {chunk.cameraDirection && (
                    <span className="text-[10px] text-muted-foreground truncate flex-1">{chunk.cameraDirection}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground shrink-0">{chunk.estimatedSeconds || 8}s</span>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-medium">Scene prompt</label>
                  <textarea
                    value={chunk.veoPrompt || ""}
                    onChange={(e) => updateChunkPrompt(i, e.target.value)}
                    rows={5}
                    className="w-full text-xs rounded-lg border border-border/40 bg-background px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
              </div>
            ))}
          </div>

          <Button
            onClick={handleApprove}
            className="w-full gradient-bg text-white hover:opacity-90 shadow-md gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Approve & Generate Video
          </Button>
        </div>
      )}

      {/* ── Progress bar ─────────────────────────────────────────────────── */}
      {status !== STATUS.DONE && status !== STATUS.ERROR && status !== STATUS.AWAITING_APPROVAL && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">{statusLabel()}</span>
            <span className="font-semibold text-primary">{progressPercent}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-linear-to-r from-primary to-violet-500 transition-all duration-700 ease-out"
              style={{ width: `${Math.max(progressPercent, isGenerating ? 4 : 0)}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">{message}</p>
        </div>
      )}

      {/* ── Beat rail ────────────────────────────────────────────────────── */}
      {totalChunks > 0 && status !== STATUS.AWAITING_APPROVAL && (
        <div className="relative">
          <div className="flex items-center gap-0 overflow-x-auto pb-2">
            {beatPlan.map((beat, idx) => {
              const beatStatus = getBeatStatus(idx);
              const isAvatar = beat.visual_type === "avatar" || beat.visualType === "avatar";
              const beatType = beat.type || beat.beatType || "PROPERTY_VISUAL";
              const colorClass = BEAT_COLORS[beatType] || BEAT_COLORS.PROPERTY_VISUAL;

              return (
                <div key={idx} className="flex items-center shrink-0">
                  {idx > 0 && (
                    <div className={`h-0.5 w-5 sm:w-7 transition-colors duration-500 ${
                      completedChunks.includes(idx - 1) ? "bg-primary" : "bg-border/40"
                    }`} />
                  )}
                  <div className="flex flex-col items-center gap-1">
                    <div className={`relative w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                      beatStatus === "done"
                        ? "border-primary bg-primary shadow-md shadow-primary/30"
                        : beatStatus === "active"
                        ? "border-primary bg-primary/10 animate-pulse"
                        : "border-border/40 bg-muted/20"
                    }`}>
                      {beatStatus === "done" ? (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      ) : beatStatus === "active" ? (
                        <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                      ) : (
                        isAvatar
                          ? <User className={`w-3.5 h-3.5 ${colorClass.split(" ")[1]}`} />
                          : <Video className={`w-3.5 h-3.5 ${colorClass.split(" ")[1]}`} />
                      )}
                    </div>
                    {beatStatus === "done" && chunkClipUrls[idx] ? (
                      <a
                        href={chunkClipUrls[idx]}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Download beat ${idx + 1}`}
                        className="text-[9px] font-medium text-primary flex items-center gap-0.5 hover:underline"
                      >
                        <Download className="w-2.5 h-2.5" />
                        clip
                      </a>
                    ) : (
                      <span className={`text-[9px] font-medium ${
                        beatStatus === "done" || beatStatus === "active" ? "text-primary" : "text-muted-foreground"
                      }`}>
                        {beatStatus === "done" ? "✓" : beatStatus === "active" ? "…" : `${beat.duration_seconds || beat.estimatedSeconds || 4}s`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Status message (non-error, non-done, non-approval) ───────────── */}
      {isGenerating && status !== STATUS.UPLOADING && (
        <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 flex gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            {status === STATUS.VOICE_GENERATING
              ? <Mic className="w-4 h-4 text-primary" />
              : status === STATUS.COMBINING
              ? <Layers className="w-4 h-4 text-primary" />
              : <Clapperboard className="w-4 h-4 text-primary" />
            }
          </div>
          <div>
            <p className="text-sm font-medium">
              {status === STATUS.VOICE_GENERATING && "Generating ElevenLabs voiceover for all narration beats…"}
              {status === STATUS.GENERATING_BASE && `Beat ${currentChunkIdx + 1}/${totalChunks} generating in parallel…`}
              {status === STATUS.EXTENDING && `Beat ${currentChunkIdx + 1}/${totalChunks} generating…`}
              {status === STATUS.COMBINING && (combineProgress || "Combining all clips via FFmpeg…")}
              {status === STATUS.IDLE && "Starting hybrid pipeline…"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {status === STATUS.COMBINING
                ? "Running in your browser — keep this tab open."
                : "All beats generate in parallel. Keep this tab open."}
            </p>
          </div>
        </div>
      )}

      {/* ── Error state ──────────────────────────────────────────────────── */}
      {status === STATUS.ERROR && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Generation failed</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                hasStarted.current = false;
                startPipeline();
              }}
              className="mt-3 gap-2 text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* ── Final Video ───────────────────────────────────────────────────── */}
      {status === STATUS.DONE && videoUrl && (
        <div className="space-y-4">
          {/* Video player */}
          <div className="relative rounded-3xl overflow-hidden border border-border/50 bg-black aspect-9/16 max-w-xs mx-auto shadow-2xl">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              loop
              playsInline
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />

            {/* Play/Pause overlay */}
            <button
              onClick={() => {
                if (!videoRef.current) return;
                isPlaying ? videoRef.current.pause() : videoRef.current.play();
              }}
              className="absolute inset-0 flex items-center justify-center group"
            >
              <div className={`w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition-opacity ${
                isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"
              }`}>
                {isPlaying
                  ? <Pause className="w-6 h-6 text-white" />
                  : <Play className="w-6 h-6 text-white ml-1" />
                }
              </div>
            </button>

            {/* Duration badge */}
            <div className="absolute bottom-3 left-3 bg-black/60 rounded-lg px-2 py-1 text-[10px] text-white font-medium backdrop-blur-sm">
              {totalDuration}s
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap justify-center">
            <Button
              onClick={handleDownload}
              className="gradient-bg text-white hover:opacity-90 shadow-lg gap-2 px-5"
            >
              <Download className="w-4 h-4" />
              Download Video
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(videoUrl, "_blank")}
              className="gap-2 px-4"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Tab
            </Button>
          </div>

          {/* Asset library note */}
          <div className="text-center">
            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Saved to your Asset Library automatically
            </p>
          </div>

          {/* Summary card */}
          <div className="rounded-2xl border border-border/50 bg-muted/10 p-4 grid grid-cols-3 divide-x divide-border/30 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground">Clips</p>
              <p className="text-xl font-bold text-primary">{totalChunks}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Duration</p>
              <p className="text-xl font-bold text-primary">{totalDuration}s</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Model</p>
              <p className="text-sm font-bold text-primary">Ken Burns</p>
            </div>
          </div>

          {/* New video */}
          <div className="flex justify-center pt-2">
            <Button variant="ghost" onClick={onReset} className="gap-2 text-muted-foreground text-sm">
              <RotateCcw className="w-4 h-4" />
              Create Another Ad
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
