"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser } from "@/hooks/use-user";
import { useAvatarsAndVoices } from "@/hooks/use-avatars-voices";
import { useRealtimeVideo } from "@/hooks/use-realtime-video";
import { toast } from "sonner";
import {
  Loader2,
  ImageIcon,
  Sparkles,
  Play,
  CheckCircle,
  AlertCircle,
  Download,
  RotateCcw,
  ChevronRight,
  PenLine,
  Volume2,
  Wand2,
} from "lucide-react";

const VOICES = [
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam (Male, Deep)" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel (Female, Calm)" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella (Female, Warm)" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni (Male, Friendly)" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli (Female, Young)" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh (Male, Narration)" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold (Male, Strong)" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi (Female, Confident)" },
];

export default function PrototypePage() {
  const { credits, user } = useUser();
  const { voices: dbVoices, avatars } = useAvatarsAndVoices();

  // Steps: 1 = Generate Image, 2 = Write Script, 3 = Generate Video
  const [step, setStep] = useState(1);

  // Step 1: Image generation
  const [avatarPrompt, setAvatarPrompt] = useState(
    "A professional Indian woman in her late 20s wearing a navy blue blazer and light blue shirt, confident smile, standing in a modern office, portrait photo, professional headshot, high quality, photorealistic"
  );
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageGenFailed, setImageGenFailed] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  // Step 2: Script
  const [script, setScript] = useState("");
  const [aiScriptLoading, setAiScriptLoading] = useState(false);

  // Step 3: Video generation
  const [voiceId, setVoiceId] = useState("21m00Tcm4TlvDq8ikWAM");
  const [expression, setExpression] = useState("professional");
  const [generating, setGenerating] = useState(false);
  const [videoResult, setVideoResult] = useState(null);
  const [videoError, setVideoError] = useState(null);

  // Realtime video tracking
  const [trackVideoId, setTrackVideoId] = useState(null);
  const realtimeVideo = useRealtimeVideo(trackVideoId);

  useEffect(() => {
    if (realtimeVideo?.status === "ready") {
      setVideoResult(realtimeVideo);
      toast.success("Video is ready!");
    } else if (realtimeVideo?.status === "error") {
      setVideoError(realtimeVideo?.error_message || "Generation failed");
      toast.error("Video generation failed");
    }
  }, [realtimeVideo?.status]);

  // Step 1: Generate avatar image
  async function handleGenerateImage() {
    if (!avatarPrompt.trim()) return;
    setGeneratingImage(true);
    setGeneratedImages([]);
    setSelectedImage(null);
    setImageGenFailed(false);

    try {
      const res = await fetch("/api/gemini-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: avatarPrompt.trim(),
          count: 2,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Image generation failed");

      setGeneratedImages(data.images || []);
      if (data.images?.length > 0) {
        setSelectedImage(data.images[0].url);
        toast.success(`${data.images.length} image(s) generated with ${data.model}`);
      }
    } catch (err) {
      setImageGenFailed(true);
      toast.error("Image generation unavailable", {
        description: "Gemini quota exceeded. Use an avatar from the library instead.",
      });
    } finally {
      setGeneratingImage(false);
    }
  }

  // Step 2: AI Script
  async function handleAiScript() {
    setAiScriptLoading(true);
    try {
      const res = await fetch("/api/ai-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: "Real Estate Property",
          product_description:
            "Luxury residential property in a prime location. Modern architecture, spacious living areas, premium amenities including swimming pool, gym, and landscaped gardens. Good investment opportunity with high ROI potential. Target audience: homebuyers and investors.",
          tone: "professional",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Script generation failed");

      if (data.scripts?.length > 0) {
        setScript(data.scripts[0].text.substring(0, 500));
        toast.success("Script generated!");
      }
    } catch (err) {
      toast.error("Script generation failed", { description: err.message });
    } finally {
      setAiScriptLoading(false);
    }
  }

  // Step 3: Generate video
  async function handleGenerateVideo() {
    if (!selectedImage || !script.trim() || script.trim().length < 10) return;
    setGenerating(true);
    setVideoResult(null);
    setVideoError(null);

    try {
      // First, upload the base64 image to Supabase storage so D-ID can access it
      let avatarUrl = selectedImage;

      // If it's a base64 image, we need to upload it first
      if (selectedImage.startsWith("data:")) {
        const uploadRes = await fetch("/api/avatars/upload", {
          method: "POST",
          body: await createFileFromBase64(selectedImage),
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || "Failed to upload avatar");
        avatarUrl = uploadData.avatar?.image_url || selectedImage;
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: script.trim(),
          avatar_url: avatarUrl,
          voice_id: voiceId,
          music_enabled: false,
          expression,
          gesture_intensity: "natural",
          head_motion: "natural",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Video generation failed");

      setTrackVideoId(data.video_id);
      toast.success("Video generation started!", {
        description: "Tracking progress in real-time...",
      });
    } catch (err) {
      setVideoError(err.message);
      toast.error("Failed", { description: err.message });
    } finally {
      setGenerating(false);
    }
  }

  // Helper: convert base64 to File for upload
  async function createFileFromBase64(dataUrl) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const formData = new FormData();
    formData.append("file", new File([blob], "ai-avatar.png", { type: "image/png" }));
    return formData;
  }

  const isVideoReady = realtimeVideo?.status === "ready";
  const isVideoError = realtimeVideo?.status === "error" || videoError;
  const isVideoGenerating =
    generating || ["queued", "generating"].includes(realtimeVideo?.status);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 animate-fade-in">
      <h1 className="text-2xl font-bold font-heading mb-1">AI Avatar Studio</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Generate an avatar, write a script, and create a talking video — all powered by AI.
      </p>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { n: 1, label: "Avatar" },
          { n: 2, label: "Script" },
          { n: 3, label: "Video" },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <button
              onClick={() => {
                if (s.n === 1) setStep(1);
                if (s.n === 2 && selectedImage) setStep(2);
                if (s.n === 3 && selectedImage && script.trim().length >= 10) setStep(3);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                step === s.n
                  ? "gradient-bg text-white shadow-md"
                  : step > s.n
                  ? "bg-green-500/10 text-green-600 border border-green-500/20"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s.n ? (
                <CheckCircle className="w-3.5 h-3.5" />
              ) : (
                <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">
                  {s.n}
                </span>
              )}
              {s.label}
            </button>
            {i < 2 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step 1: Generate Avatar */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <Textarea
              placeholder="Describe the avatar you want to create... e.g., 'Professional Indian woman in a navy blazer, confident, modern office background'"
              className="min-h-[100px] border-0 resize-none focus-visible:ring-0 rounded-b-none text-base p-4"
              value={avatarPrompt}
              onChange={(e) => setAvatarPrompt(e.target.value)}
              maxLength={500}
              disabled={generatingImage}
            />
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/50">
              <p className="text-[11px] text-muted-foreground">
                {avatarPrompt.length}/500 — Powered by Gemini
              </p>
              <Button
                size="sm"
                className="gradient-bg text-white cursor-pointer shadow-sm"
                disabled={!avatarPrompt.trim() || generatingImage}
                onClick={handleGenerateImage}
              >
                {generatingImage ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                    Generate Avatar
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-2">
            {[
              "Professional Indian woman in navy blazer, confident smile, modern office",
              "Indian businessman in suit, clean background, professional headshot",
              "Young Indian female real estate agent, friendly, outdoor property background",
              "Indian man in formal shirt, trustworthy expression, corporate setting",
            ].map((p, i) => (
              <button
                key={i}
                onClick={() => setAvatarPrompt(p)}
                disabled={generatingImage}
                className="text-[11px] px-2.5 py-1.5 rounded-lg bg-muted hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer text-left"
              >
                {p.substring(0, 60)}...
              </button>
            ))}
          </div>

          {/* Image gen failed — show library fallback */}
          {(imageGenFailed || showLibrary) && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-sm font-medium text-yellow-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {imageGenFailed
                    ? "Image generation unavailable (Gemini quota exceeded for today)"
                    : "Choose from your avatar library"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Pick an avatar from the library below — the pipeline still works!
                </p>
              </div>

              {/* Avatar library grid */}
              <p className="text-sm font-medium">Avatar Library</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto">
                {(avatars || []).map((avatar) => (
                  <button
                    key={avatar.id}
                    onClick={() => {
                      setSelectedImage(avatar.image_url);
                      toast.success("Avatar selected!");
                    }}
                    className={`rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                      selectedImage === avatar.image_url
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <img
                      src={avatar.image_url}
                      alt={avatar.name || "Avatar"}
                      className="w-full aspect-square object-cover"
                    />
                  </button>
                ))}
                {(!avatars || avatars.length === 0) && (
                  <p className="text-xs text-muted-foreground col-span-full py-4 text-center">
                    No avatars in library. Upload one below.
                  </p>
                )}
              </div>

              {/* Or enter any image URL */}
              <div className="flex gap-2">
                <Input
                  placeholder="Or paste any image URL..."
                  className="text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.target.value.trim()) {
                      setSelectedImage(e.target.value.trim());
                      toast.success("Image URL set!");
                    }
                  }}
                />
              </div>

              {selectedImage && (
                <Button
                  className="w-full gradient-bg text-white cursor-pointer shadow-lg"
                  onClick={() => setStep(2)}
                >
                  Continue with this avatar
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          )}

          {/* Or use library button (when gen hasn't failed yet) */}
          {!imageGenFailed && !showLibrary && generatedImages.length === 0 && !generatingImage && (
            <button
              onClick={() => setShowLibrary(true)}
              className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer underline underline-offset-4"
            >
              Or choose from your avatar library
            </button>
          )}

          {/* Generated images */}
          {generatedImages.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">
                  Choose your avatar ({generatedImages.length} generated)
                </p>
                {generatedImages[0]?.source?.includes("pollinations") && (
                  <Badge variant="outline" className="text-[10px] text-yellow-600 border-yellow-500/30">
                    Via Pollinations (Gemini quota exceeded)
                  </Badge>
                )}
              </div>
              {generatedImages[0]?.source?.includes("pollinations") && (
                <p className="text-[11px] text-muted-foreground">
                  Images generate on-demand — please wait 10-20 seconds for them to appear.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                {generatedImages.map((img, i) => (
                  <AvatarImageCard
                    key={i}
                    img={img}
                    index={i}
                    selected={selectedImage === img.url}
                    onSelect={() => setSelectedImage(img.url)}
                  />
                ))}
              </div>

              {selectedImage && (
                <Button
                  className="w-full gradient-bg text-white cursor-pointer shadow-lg"
                  onClick={() => setStep(2)}
                >
                  Continue with this avatar
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Write Script */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Avatar preview */}
          {selectedImage && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
              <img
                src={selectedImage}
                alt="Selected avatar"
                className="w-12 h-16 rounded-lg object-cover"
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Avatar selected</p>
                <p className="text-[11px] text-muted-foreground">
                  AI-generated with Gemini
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs cursor-pointer"
                onClick={() => setStep(1)}
              >
                Change
              </Button>
            </div>
          )}

          {/* Script input */}
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <Textarea
              placeholder="Write your real estate script here... or click 'AI Write' to generate one automatically"
              className="min-h-[140px] border-0 resize-none focus-visible:ring-0 rounded-b-none text-base p-4"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              maxLength={500}
            />
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/50">
              <p className="text-[11px] text-muted-foreground">
                {script.length}/500
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs cursor-pointer"
                  disabled={aiScriptLoading}
                  onClick={handleAiScript}
                >
                  {aiScriptLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Writing...
                    </>
                  ) : (
                    <>
                      <PenLine className="w-3 h-3 mr-1" />
                      AI Write
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Quick real estate scripts */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Quick scripts:</p>
            <div className="space-y-1.5">
              {[
                "Looking for your dream home? This stunning 3BHK apartment in Gurgaon offers modern living at its finest. Spacious rooms, premium finishes, and a view that will take your breath away. With easy EMI options starting at just 45,000 per month, your dream home is closer than you think. Schedule a free site visit today!",
                "Attention investors! This premium commercial property in Noida is delivering 12% annual returns. Located near the metro station with 100% occupancy rate. Prices are going up next month. Book now with just 10% down payment. Limited units available. Call now for an exclusive offer!",
                "Welcome to the most talked about township in Pune. Spread across 50 acres with 3 swimming pools, a clubhouse, jogging track, and 24/7 security. 2, 3, and 4 BHK options available. RERA approved. Bank loans pre-approved. Visit our sample flat this weekend and get special launch pricing!",
              ].map((s, i) => (
                <button
                  key={i}
                  onClick={() => setScript(s)}
                  className="w-full text-left text-xs p-2.5 rounded-lg bg-muted hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer line-clamp-2"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {script.trim().length >= 10 && (
            <Button
              className="w-full gradient-bg text-white cursor-pointer shadow-lg"
              onClick={() => setStep(3)}
            >
              Continue to video settings
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      )}

      {/* Step 3: Generate Video */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Avatar + Script preview */}
          <div className="p-4 rounded-xl bg-muted/50 border border-border/50 space-y-3">
            <div className="flex items-start gap-3">
              {selectedImage && (
                <img
                  src={selectedImage}
                  alt="Avatar"
                  className="w-16 h-20 rounded-lg object-cover shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground mb-1">Script preview</p>
                <p className="text-sm line-clamp-3">{script}</p>
              </div>
            </div>
          </div>

          {/* Voice selection */}
          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
              Voice
            </Label>
            <Select value={voiceId} onValueChange={setVoiceId}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(dbVoices?.length > 0 ? dbVoices : VOICES).map((v) => (
                  <SelectItem key={v.id || v.voice_id} value={v.id || v.voice_id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Expression */}
          <div className="space-y-2">
            <Label className="text-sm">Expression</Label>
            <div className="flex flex-wrap gap-2">
              {["friendly", "professional", "excited", "calm", "serious"].map(
                (e) => (
                  <button
                    key={e}
                    onClick={() => setExpression(e)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all cursor-pointer ${
                      expression === e
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {e}
                  </button>
                )
              )}
            </div>
          </div>

          <Separator />

          {/* Video result / Generate button */}
          {isVideoReady ? (
            <div className="space-y-3">
              <div className="rounded-xl overflow-hidden border border-border bg-black">
                <video
                  src={realtimeVideo?.video_url}
                  controls
                  className="w-full"
                  autoPlay
                />
              </div>
              <div className="flex gap-2">
                <a
                  href={realtimeVideo?.video_url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button className="w-full gradient-bg text-white cursor-pointer">
                    <Download className="w-4 h-4 mr-2" />
                    Download Video
                  </Button>
                </a>
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => {
                    setTrackVideoId(null);
                    setVideoResult(null);
                    setVideoError(null);
                    setStep(1);
                    setGeneratedImages([]);
                    setSelectedImage(null);
                    setScript("");
                  }}
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  New
                </Button>
              </div>
            </div>
          ) : isVideoError ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <p className="text-sm text-destructive font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {videoError || realtimeVideo?.error_message || "Generation failed"}
                </p>
              </div>
              <Button
                className="w-full gradient-bg text-white cursor-pointer"
                onClick={handleGenerateVideo}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Retry (2 Credits)
              </Button>
            </div>
          ) : isVideoGenerating ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <div>
                  <p className="text-sm font-medium">
                    {realtimeVideo?.status === "generating"
                      ? "Generating TTS and lip-sync..."
                      : "Queued, starting soon..."}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This takes 30-90 seconds. Don&apos;t close this page.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Button
                className="w-full gradient-bg text-white cursor-pointer shadow-lg"
                size="lg"
                disabled={!user || credits < 2}
                onClick={handleGenerateVideo}
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Generate Video (2 Credits)
              </Button>
              {credits < 2 && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Not enough credits.
                </p>
              )}
              <p className="text-[11px] text-muted-foreground text-center">
                Gemini avatar + ElevenLabs voice + D-ID lip-sync
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Image card with loading state (Pollinations images generate on-demand)
function AvatarImageCard({ img, index, selected, onSelect }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <button
      onClick={onSelect}
      className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
        selected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/30"
      }`}
    >
      {/* Loading shimmer */}
      {!loaded && !error && (
        <div className="w-full aspect-[3/4] bg-muted animate-pulse flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          <p className="text-[11px] text-muted-foreground">Generating...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="w-full aspect-[3/4] bg-muted flex flex-col items-center justify-center gap-2">
          <AlertCircle className="w-6 h-6 text-muted-foreground" />
          <p className="text-[11px] text-muted-foreground">Failed to load</p>
        </div>
      )}

      {/* Actual image */}
      <img
        src={img.url}
        alt={`Avatar option ${index + 1}`}
        className={`w-full aspect-[3/4] object-cover ${loaded ? "" : "hidden"}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </button>
  );
}
