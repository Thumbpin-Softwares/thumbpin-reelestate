"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useUser } from "@/hooks/use-user";
import { useRealtimeVideo } from "@/hooks/use-realtime-video";
import { useAvatarsAndVoices } from "@/hooks/use-avatars-voices";
import { toast } from "sonner";
import {
  Wand2,
  Upload,
  CheckCircle,
  Music,
  Sparkles,
  AlertCircle,
  Loader2,
  Download,
  RotateCcw,
  Smile,
  Hand,
  Move3d,
  PenLine,
} from "lucide-react";

const STATUS_MAP = {
  queued: { label: "Queued – Waiting in line...", progress: 10 },
  generating: { label: "Generating – TTS & Lip-Sync...", progress: 50 },
  ready: { label: "Video Ready! 🎉", progress: 100 },
  error: { label: "Generation Failed", progress: 0 },
};

const EXPRESSION_PRESETS = [
  { id: "friendly", label: "😊 Friendly", description: "Warm, approachable" },
  { id: "professional", label: "💼 Professional", description: "Confident, polished" },
  { id: "excited", label: "🤩 Excited", description: "High energy, enthusiastic" },
  { id: "calm", label: "😌 Calm", description: "Relaxed, trustworthy" },
  { id: "serious", label: "🧐 Serious", description: "Authoritative, focused" },
];

const GESTURE_LEVELS = [
  { id: "subtle", label: "Subtle", factor: 0.3 },
  { id: "natural", label: "Natural", factor: 0.6 },
  { id: "expressive", label: "Expressive", factor: 1.0 },
];

const HEAD_MOTION_LEVELS = [
  { id: "minimal", label: "Minimal" },
  { id: "natural", label: "Natural" },
  { id: "dynamic", label: "Dynamic" },
];

const STORAGE_KEY = "generatePageState";

export default function GeneratePage() {
  const { credits, profile, user } = useUser();
  const demoBugs = process.env.NEXT_PUBLIC_DEMO_BUGS === "true";
  const {
    avatars,
    customAvatars,
    libraryAvatars,
    voices,
    loading: loadingAssets,
    uploading,
    uploadAvatar,
  } = useAvatarsAndVoices();

  const [script, setScript] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [videoId, setVideoId] = useState(null);
  const [error, setError] = useState(null);
  const [isRestored, setIsRestored] = useState(false);
  const [restoredAvatarId, setRestoredAvatarId] = useState(null);
  const [restoredAvatarUrl, setRestoredAvatarUrl] = useState(null);

  // Gesture & Expression state
  const [expression, setExpression] = useState("friendly");
  const [gestureIntensity, setGestureIntensity] = useState("natural");
  const [headMotion, setHeadMotion] = useState("natural");

  // AI Script Writer state
  const [aiScriptOpen, setAiScriptOpen] = useState(false);
  const [aiProductName, setAiProductName] = useState("");
  const [aiProductDesc, setAiProductDesc] = useState("");
  const [aiTone, setAiTone] = useState("friendly");
  const [aiScripts, setAiScripts] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);

  const fileInputRef = useRef(null);

  // Realtime tracking of video status
  const { video: realtimeVideo } = useRealtimeVideo(videoId);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { setIsRestored(true); return; }
      const saved = JSON.parse(raw);

      if (saved.script) setScript(saved.script);
      if (saved.selectedVoice) setSelectedVoice(saved.selectedVoice);
      if (typeof saved.musicEnabled === "boolean") setMusicEnabled(saved.musicEnabled);
      if (saved.expression) setExpression(saved.expression);
      if (saved.gestureIntensity) setGestureIntensity(saved.gestureIntensity);
      if (saved.headMotion) setHeadMotion(saved.headMotion);

      if (saved.videoId) {
        setVideoId(saved.videoId);
        setGenerating(true);
      }

      if (saved.selectedAvatarId) setRestoredAvatarId(saved.selectedAvatarId);
      if (saved.selectedAvatarUrl) setRestoredAvatarUrl(saved.selectedAvatarUrl);
    } catch (err) {
      console.error("Failed to restore generate state:", err);
    } finally {
      setIsRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!restoredAvatarId && !restoredAvatarUrl) return;
    const all = [...(avatars || []), ...(customAvatars || []), ...(libraryAvatars || [])];
    const match = all.find((a) => a.id === restoredAvatarId || a.image_url === restoredAvatarUrl);
    if (match) {
      setSelectedAvatar(match);
      setRestoredAvatarId(null);
      setRestoredAvatarUrl(null);
    }
  }, [avatars, customAvatars, libraryAvatars, restoredAvatarId, restoredAvatarUrl]);

  const canGenerate =
    script.trim().length > 10 &&
    selectedAvatar &&
    selectedVoice &&
    credits >= 2 &&
    !generating;

  // Handle realtime status changes
  useEffect(() => {
    if (!realtimeVideo) return;

    const status = realtimeVideo.status;

    if (status === "ready") {
      setGenerating(false);
      toast.success("Video generated successfully! 🎉", {
        description: "Your video is ready to download and share.",
      });

      // Trigger confetti
      (async () => {
        try {
          const confetti = (await import("canvas-confetti")).default;
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#8B5CF6", "#D4AF37", "#EC4899"],
          });
        } catch {}
      })();
    }

    if (status === "error") {
      setGenerating(false);
      setError(realtimeVideo.error_message || "Video generation failed");
      toast.error("Video generation failed", {
        description:
          realtimeVideo.error_message ||
          "Please try again. Credits have been refunded.",
      });
    }
  }, [realtimeVideo?.status]);

  useEffect(() => {
    if (!isRestored) return;
    try {
      const payload = {
        script,
        selectedVoice,
        musicEnabled,
        expression,
        gestureIntensity,
        headMotion,
        videoId,
        selectedAvatarId: selectedAvatar?.id || null,
        selectedAvatarUrl: selectedAvatar?.image_url || null,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error("Failed to persist generate state:", err);
    }
  }, [
    isRestored,
    script,
    selectedVoice,
    musicEnabled,
    expression,
    gestureIntensity,
    headMotion,
    videoId,
    selectedAvatar,
  ]);

  // Template prefill from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("template_prefill");
      if (stored) {
        const data = JSON.parse(stored);
        if (data.script) setScript(data.script);
        sessionStorage.removeItem("template_prefill");
        toast.info(`Template loaded: ${data.template_name || "Custom"}`, {
          description: "Script has been pre-filled. Customize as needed!",
        });
      }
    } catch {}
  }, []);

  // AI Script Writer
  async function handleAiGenerate() {
    if (!aiProductName.trim() || !aiProductDesc.trim()) {
      toast.error("Please fill in product name and description");
      return;
    }
    setAiLoading(true);
    setAiScripts([]);
    try {
      const res = await fetch("/api/ai-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: aiProductName.trim(),
          product_description: aiProductDesc.trim(),
          tone: aiTone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate scripts");
      setAiScripts(data.scripts || []);
      if (data.source === "template") {
        toast.info("Scripts generated from templates", {
          description: "Add a GEMINI_API_KEY in .env.local for AI-powered scripts.",
        });
      }
    } catch (err) {
      toast.error("Script generation failed", { description: err.message });
    } finally {
      setAiLoading(false);
    }
  }

  async function handleInlineUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Use JPEG, PNG, or WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Maximum 5MB.");
      return;
    }

    const name = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
    const result = await uploadAvatar(file, name);

    if (result.success) {
      toast.success("Avatar uploaded!", { description: `"${name}" is ready to use.` });
      setSelectedAvatar(result.avatar);
    } else {
      toast.error("Upload failed", { description: result.error });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleGenerate() {
    if (!canGenerate) {
      if (credits < 2)
        toast.error(
          "Not enough credits! You need 2 credits to generate a video."
        );
      return;
    }

    setGenerating(true);
    setError(null);
    setVideoId(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: script.trim(),
          avatar_url: selectedAvatar.image_url,
          voice_id: selectedVoice,
          music_enabled: musicEnabled,
          expression,
          gesture_intensity: gestureIntensity,
          head_motion: headMotion,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start video generation");
      }

      setVideoId(data.video_id);
      toast.info("Video generation started!", {
        description:
          "This typically takes 1-2 minutes. Stay on this page to track progress.",
      });
    } catch (err) {
      setGenerating(false);
      setError(err.message);
      toast.error("Failed to start generation", {
        description: err.message,
      });
    }
  }

  function handleReset() {
    setVideoId(null);
    setError(null);
    setGenerating(false);
  }

  // Determine current status for UI
  const currentVideoStatus = realtimeVideo?.status || (generating ? "queued" : null);
  const statusInfo = currentVideoStatus ? STATUS_MAP[currentVideoStatus] : null;
  const isReady = currentVideoStatus === "ready";
  const isError = currentVideoStatus === "error";
  const videoUrl = realtimeVideo?.video_url;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Hidden file input for inline upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleInlineUpload}
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-heading">
          Generate Video
        </h1>
        <p className="text-muted-foreground mt-1">
          Create a viral UGC ad in 4 simple steps
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column – Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Script */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-6 h-6 rounded-full gradient-bg text-white text-xs flex items-center justify-center font-bold">
                  1
                </span>
                Write Your Script
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Write your ad script here... e.g., 'Try our new vitamin C serum – glowing skin in just 7 days! Click the link in bio to shop now. Limited offer for first 100 customers! Use code GLOW20 for 20% off.'"
                className="min-h-35 resize-none"
                value={script}
                onChange={(e) => setScript(e.target.value)}
                maxLength={500}
                disabled={generating}
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  {demoBugs ? `${script.length + 47}/500` : `${script.length}/500`} characters {demoBugs ? '' : '• Min 10 characters'}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer text-xs h-7"
                    onClick={() => setAiScriptOpen(true)}
                    disabled={generating}
                  >
                    <PenLine className="w-3 h-3 mr-1" />
                    ✨ AI Write
                  </Button>
                  <Badge variant="secondary" className="text-xs">
                    💡 Tip: Start with a hook
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Avatar */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-6 h-6 rounded-full gradient-bg text-white text-xs flex items-center justify-center font-bold">
                  2
                </span>
                Choose Avatar
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* My Avatars Section */}
              {customAvatars.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    My Uploaded Avatars
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                    {customAvatars.slice(0, 6).map((avatar) => (
                      <button
                        key={avatar.id}
                        onClick={() => setSelectedAvatar(avatar)}
                        disabled={generating}
                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer group ${
                          selectedAvatar?.id === avatar.id
                            ? "border-primary ring-2 ring-primary/30 scale-105"
                            : "border-primary/30 hover:border-primary/50"
                        } ${generating ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <div className="w-full h-full bg-linear-to-br from-primary/10 to-accent/10 flex items-center justify-center overflow-hidden">
                          {avatar.image_url?.startsWith("http") ? (
                            <img
                              src={avatar.image_url}
                              alt={avatar.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-lg font-bold text-primary/70">
                              {avatar.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </span>
                          )}
                        </div>
                        {selectedAvatar?.id === avatar.id && (
                          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <Badge className="absolute top-1 left-1 bg-primary/80 text-white text-[8px] px-1 py-0 border-0">
                          Custom
                        </Badge>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[10px] text-white text-center truncate">
                            {avatar.name}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <Separator className="my-3" />
                </div>
              )}

              {/* Library Avatars */}
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                Avatar Library
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                {libraryAvatars.slice(0, 12).map((avatar) => (
                  <button
                    key={avatar.id}
                    onClick={() => setSelectedAvatar(avatar)}
                    disabled={generating}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer group ${
                      selectedAvatar?.id === avatar.id
                        ? "border-primary ring-2 ring-primary/30 scale-105"
                        : "border-border/50 hover:border-primary/50"
                    } ${generating ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="w-full h-full gradient-bg-subtle flex items-center justify-center overflow-hidden">
                      {avatar.image_url && avatar.image_url.startsWith("http") ? (
                        <img
                          src={avatar.image_url}
                          alt={avatar.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-bold text-primary/70">
                          {avatar.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                      )}
                    </div>
                    {selectedAvatar?.id === avatar.id && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[10px] text-white text-center truncate">
                        {avatar.name}
                      </p>
                    </div>
                  </button>
                ))}

                {/* Upload Custom */}
                <button
                  className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  disabled={generating || uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5 text-muted-foreground" />
                  )}
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {uploading ? "Uploading..." : "Upload"}
                  </span>
                </button>
              </div>

              {selectedAvatar && (
                <div className="mt-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="text-sm">
                    Selected: <strong>{selectedAvatar.name}</strong>
                    <span className="text-muted-foreground ml-1">
                      ({selectedAvatar.ethnicity})
                    </span>
                    {selectedAvatar.is_custom && (
                      <Badge className="ml-2 bg-primary/10 text-primary border-primary/20 text-[10px]">
                        Custom
                      </Badge>
                    )}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Expression & Gesture */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-6 h-6 rounded-full gradient-bg text-white text-xs flex items-center justify-center font-bold">
                  3
                </span>
                Expression & Gesture
                <Badge variant="secondary" className="text-[10px] ml-1">
                  NEW
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Expression Preset */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Smile className="w-4 h-4 text-muted-foreground" />
                  Expression Style
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {EXPRESSION_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setExpression(preset.id)}
                      disabled={generating}
                      className={`rounded-lg border-2 p-2.5 text-center transition-all cursor-pointer ${
                        expression === preset.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border/50 hover:border-primary/30"
                      } ${generating ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <p className="text-sm font-medium">{preset.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {preset.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Gesture Intensity */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Hand className="w-4 h-4 text-muted-foreground" />
                  Gesture Intensity
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {GESTURE_LEVELS.map((level) => (
                    <button
                      key={level.id}
                      onClick={() => setGestureIntensity(level.id)}
                      disabled={generating}
                      className={`rounded-lg border-2 p-3 text-center transition-all cursor-pointer ${
                        gestureIntensity === level.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border/50 hover:border-primary/30"
                      } ${generating ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <p className="text-sm font-medium">{level.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Head Motion */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Move3d className="w-4 h-4 text-muted-foreground" />
                  Head Motion
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {HEAD_MOTION_LEVELS.map((level) => (
                    <button
                      key={level.id}
                      onClick={() => setHeadMotion(level.id)}
                      disabled={generating}
                      className={`rounded-lg border-2 p-3 text-center transition-all cursor-pointer ${
                        headMotion === level.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border/50 hover:border-primary/30"
                      } ${generating ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <p className="text-sm font-medium">{level.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 4: Voice & Settings */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-6 h-6 rounded-full gradient-bg text-white text-xs flex items-center justify-center font-bold">
                  4
                </span>
                Voice & Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Indian-Accent Voice</Label>
                <Select
                  value={selectedVoice}
                  onValueChange={setSelectedVoice}
                  disabled={generating}
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue placeholder="Select a voice..." />
                  </SelectTrigger>
                  <SelectContent>
                    {voices.map((voice) => (
                      <SelectItem
                        key={voice.id}
                        value={voice.provider_voice_id}
                      >
                        <div className="flex items-center gap-2">
                          <span>{voice.name}</span>
                          <span className="text-xs text-muted-foreground">
                            • {voice.accent}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <Label className="cursor-pointer">Background Music</Label>
                    <p className="text-xs text-muted-foreground">
                      Soft trending beats overlay
                    </p>
                  </div>
                </div>
                <Switch
                  checked={musicEnabled}
                  onCheckedChange={setMusicEnabled}
                  disabled={generating}
                  className="cursor-pointer"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column – Preview & Generate */}
        <div className="space-y-4">
          <Card className="border-border/50 sticky top-20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Preview & Generate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preview Panel */}
              <div className="aspect-9/16 rounded-xl bg-linear-to-b from-primary/10 to-accent/10 flex items-center justify-center border border-border/50 overflow-hidden relative">
                {isReady && videoUrl ? (
                  <video
                    src={videoUrl}
                    controls
                    className="absolute inset-0 w-full h-full object-cover rounded-xl"
                    playsInline
                    autoPlay
                    muted
                  />
                ) : isError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                    <AlertCircle className="w-12 h-12 text-destructive mb-3" />
                    <p className="text-sm font-semibold text-destructive">
                      Generation Failed
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-50">
                      {error || "An error occurred"}
                    </p>
                    <p className="text-xs text-green-600 mt-2">
                      ✓ Credits refunded
                    </p>
                  </div>
                ) : generating || currentVideoStatus ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
                    <p className="text-sm font-medium">
                      {statusInfo?.label || "Processing..."}
                    </p>
                    <Progress
                      value={statusInfo?.progress || 10}
                      className="w-3/4 mt-3 h-2"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      {statusInfo?.progress || 10}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Usually takes 1-2 minutes
                    </p>
                  </div>
                ) : (
                  <div className="text-center p-4">
                    <Wand2 className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Your video preview will appear here
                    </p>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Script</span>
                  <span>{script.length > 0 ? "✓" : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avatar</span>
                  <span>
                    {selectedAvatar ? (
                      <span className="flex items-center gap-1">
                        ✓
                        {selectedAvatar.is_custom && (
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                            Custom
                          </Badge>
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expression</span>
                  <span className="text-xs">
                    {EXPRESSION_PRESETS.find((e) => e.id === expression)?.label || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gesture</span>
                  <span className="text-xs capitalize">{gestureIntensity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Voice</span>
                  <span>{selectedVoice ? "✓" : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Music</span>
                  <span>{musicEnabled ? "On" : "Off"}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Cost</span>
                  <span className="text-primary">2 Credits</span>
                </div>
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>Balance after</span>
                  <span>{Math.max(0, credits - 2)} Credits</span>
                </div>
              </div>

              {/* Action Buttons */}
              {isReady && videoUrl ? (
                <div className="space-y-2">
                  <a
                    href={videoUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button className="w-full gradient-bg text-white cursor-pointer shadow-lg">
                      <Download className="w-4 h-4 mr-2" />
                      Download HD Video
                    </Button>
                  </a>
                  <Button
                    variant="outline"
                    className="w-full cursor-pointer"
                    onClick={handleReset}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Generate Another
                  </Button>
                </div>
              ) : isError ? (
                <div className="space-y-2">
                  <Button
                    className="w-full gradient-bg text-white cursor-pointer shadow-lg"
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Retry Generation (2 Credits)
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full cursor-pointer"
                    onClick={handleReset}
                  >
                    Start Fresh
                  </Button>
                </div>
              ) : (
                <Button
                  className="w-full gradient-bg text-white cursor-pointer shadow-lg"
                  size="lg"
                  disabled={!canGenerate || generating}
                  onClick={handleGenerate}
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Video (2 Credits)
                    </>
                  )}
                </Button>
              )}

              {credits < 2 && !generating && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Not enough credits. Please upgrade.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI Script Writer Dialog */}
      <Dialog open={aiScriptOpen} onOpenChange={setAiScriptOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="w-5 h-5 text-primary" />
              AI Script Writer
            </DialogTitle>
            <DialogDescription>
              Describe your product and we&apos;ll generate 3 script variations for your video.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Product Name *</Label>
              <Input
                placeholder="e.g., GlowUp Vitamin C Serum"
                value={aiProductName}
                onChange={(e) => setAiProductName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Product Description *</Label>
              <Textarea
                placeholder="Describe your product, its benefits, target audience, and any offers/discounts..."
                className="min-h-20 resize-none"
                value={aiProductDesc}
                onChange={(e) => setAiProductDesc(e.target.value)}
                maxLength={500}
              />
            </div>
            <div className="space-y-2">
              <Label>Tone</Label>
              <div className="flex flex-wrap gap-2">
                {["friendly", "professional", "excited", "calm", "serious"].map(
                  (t) => (
                    <button
                      key={t}
                      onClick={() => setAiTone(t)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all cursor-pointer ${
                        aiTone === t
                          ? "bg-primary text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {t}
                    </button>
                  )
                )}
              </div>
            </div>

            <Button
              className="w-full gradient-bg text-white cursor-pointer shadow-lg"
              disabled={aiLoading || !aiProductName.trim() || !aiProductDesc.trim()}
              onClick={handleAiGenerate}
            >
              {aiLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Scripts...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate 3 Script Variations
                </>
              )}
            </Button>

            {/* Generated Scripts */}
            {aiScripts.length > 0 && (
              <div className="space-y-3">
                <Separator />
                <p className="text-sm font-semibold">Choose a script:</p>
                {aiScripts.map((s, i) => (
                  <Card
                    key={i}
                    className="border-border/50 hover:border-primary/50 transition-colors cursor-pointer group"
                    onClick={() => {
                      setScript(s.text.substring(0, 500));
                      setAiScriptOpen(false);
                      toast.success(`Script "${s.title}" applied!`);
                    }}
                  >
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{s.title}</p>
                        <Badge variant="secondary" className="text-[10px]">
                          {s.word_count} words
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        {s.text}
                      </p>
                      <p className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to use this script →
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
