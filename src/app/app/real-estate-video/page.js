"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useHeygen } from "@/hooks/use-heygen";
import {
  Building2,
  Upload,
  Loader2,
  Download,
  RotateCcw,
  CheckCircle2,
  Clock,
  Video,
  User,
  Users,
  ImagePlus,
  Mic,
  Play,
  Sparkles,
  X,
  Info,
  Wand2,
  Camera,
  RefreshCw,
} from "lucide-react";
import { AssetSelector } from "@/components/dashboard/asset-selector";

const STEPS = ["Avatar", "Property", "Script & Voice", "Generate"];

const ASPECT_RATIOS = [
  { value: "16:9", label: "16:9 — Landscape (YouTube / TV)" },
  { value: "9:16", label: "9:16 — Portrait (Reels / Shorts)" },
  { value: "1:1", label: "1:1 — Square (Instagram)" },
];

const LANGUAGES = [
  { id: "english", label: "English" },
  { id: "hindi", label: "Hindi" },
  { id: "hinglish", label: "Hinglish" },
];

const TONES = [
  { id: "professional", label: "Professional" },
  { id: "friendly", label: "Friendly" },
  { id: "luxury", label: "Luxury" },
  { id: "energetic", label: "Energetic" },
  { id: "warm", label: "Warm" },
];

const STORAGE_KEY = "realEstateVideoState";

function dataUrlToFile(dataUrl, filename) {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function RealEstateVideoContent() {
  const [step, setStep] = useState(0);

  // Avatar state
  const [avatarMode, setAvatarMode] = useState("library"); // "library" | "twin"
  const [selectedAvatarId, setSelectedAvatarId] = useState(null);
  const [selectedAvatarName, setSelectedAvatarName] = useState("");
  const [avatarSearch, setAvatarSearch] = useState("");
  // Digital Twin state
  const [twinFile, setTwinFile] = useState(null);
  const [consentFile, setConsentFile] = useState(null);
  const [twinName, setTwinName] = useState("");
  const [twinId, setTwinId] = useState(null);
  const [twinAvatarId, setTwinAvatarId] = useState(null);
  const [twinStatus, setTwinStatus] = useState(null); // "uploading"|"training"|"ready"|"failed"
  const [trainingProgress, setTrainingProgress] = useState("");

  // AI Photo Avatar state
  const [photoForm, setPhotoForm] = useState({
    name: "My Avatar",
    age: "Young Adult",
    gender: "Woman",
    ethnicity: "White",
    skinTone: "",
    hair: "",
    dressingStyle: "",
    accessories: "",
    place: "",
    orientation: "square",
    pose: "half_body",
    style: "Realistic",
    appearance: "",
    extraNotes: "",
  });
  const [photoGenId, setPhotoGenId] = useState(null);
  const [photoGenStatus, setPhotoGenStatus] = useState(null); // null|"generating"|"success"|"failed"
  const [photoImageKey, setPhotoImageKey] = useState(null);
  const [photoImageUrl, setPhotoImageUrl] = useState(null);
  const [photoGroupId, setPhotoGroupId] = useState(null);
  const [photoGroupStatus, setPhotoGroupStatus] = useState(null); // null|"creating"|"training"|"ready"|"failed"
  const [photoAvatarId, setPhotoAvatarId] = useState(null);
  const [photoLookPrompt, setPhotoLookPrompt] = useState("");
  const [photoLooks, setPhotoLooks] = useState([]); // [{image_url, image_key, generation_id, status}]
  const [photoVariations, setPhotoVariations] = useState([]); // [{url, key}]
  const [generatingLook, setGeneratingLook] = useState(false);
  const [selectedLookKey, setSelectedLookKey] = useState(null);
  const [photoSubStep, setPhotoSubStep] = useState(0); // 0=form, 1=preview+group, 2=looks, 3=pick
  const photoUploadRef = useRef(null);

  // Background state
  const [bgFile, setBgFile] = useState(null);
  const [bgPreview, setBgPreview] = useState(null);
  const [bgAssetId, setBgAssetId] = useState(null);
  const [bgUploading, setBgUploading] = useState(false);

  // Script & voice state
  const [script, setScript] = useState("");
  const [scriptLanguage, setScriptLanguage] = useState("english");
  const [scriptTone, setScriptTone] = useState("professional");
  const [allowEmotionTags, setAllowEmotionTags] = useState(true);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [propertyDrawerOpen, setPropertyDrawerOpen] = useState(false);
  const [propertyBrief, setPropertyBrief] = useState({
    location: "",
    propertyType: "",
    price: "",
    bedrooms: "",
    bathrooms: "",
    area: "",
    keyFeatures: "",
    amenities: "",
  });
  const [selectedVoiceId, setSelectedVoiceId] = useState(null);
  const [voiceSearch, setVoiceSearch] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [videoId, setVideoId] = useState(null);
  const [videoStatus, setVideoStatus] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState(null);
  const [isRestored, setIsRestored] = useState(false);

  const searchParams = useSearchParams();
  const initialAvatarId = searchParams.get("avatarId");
  const initialMode = searchParams.get("mode");

  useEffect(() => {
    if (initialAvatarId) {
      setSelectedAvatarId(initialAvatarId);
      if (initialMode === "photo") {
        setAvatarMode("photo");
      }
    }
  }, [initialAvatarId, initialMode]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { setIsRestored(true); return; }
      const saved = JSON.parse(raw);

      if (saved.step !== undefined) setStep(saved.step);
      if (saved.avatarMode) setAvatarMode(saved.avatarMode);
      if (saved.selectedAvatarId) setSelectedAvatarId(saved.selectedAvatarId);
      if (saved.selectedAvatarName) setSelectedAvatarName(saved.selectedAvatarName);
      if (saved.twinAvatarId) setTwinAvatarId(saved.twinAvatarId);
      if (saved.photoAvatarId) setPhotoAvatarId(saved.photoAvatarId);

      if (saved.bgPreview) setBgPreview(saved.bgPreview);
      if (saved.bgFile) setBgFile(dataUrlToFile(saved.bgFile, "property.png"));
      if (saved.bgAssetId) setBgAssetId(saved.bgAssetId);

      if (saved.script) setScript(saved.script);
      if (saved.scriptLanguage) setScriptLanguage(saved.scriptLanguage);
      if (saved.scriptTone) setScriptTone(saved.scriptTone);
      if (typeof saved.allowEmotionTags === "boolean") setAllowEmotionTags(saved.allowEmotionTags);
      if (saved.propertyBrief) setPropertyBrief(saved.propertyBrief);

      if (saved.selectedVoiceId) setSelectedVoiceId(saved.selectedVoiceId);
      if (saved.aspectRatio) setAspectRatio(saved.aspectRatio);

      if (saved.videoId) setVideoId(saved.videoId);
      if (saved.videoStatus) setVideoStatus(saved.videoStatus);
      if (saved.videoUrl) setVideoUrl(saved.videoUrl);
      if (saved.thumbnailUrl) setThumbnailUrl(saved.thumbnailUrl);
    } catch (err) {
      console.error("Failed to restore real estate state:", err);
    } finally {
      setIsRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!isRestored) return;
    let cancelled = false;

    async function saveState() {
      try {
        const bgFileData = bgFile instanceof File ? await fileToDataUrl(bgFile) : null;
        const payload = {
          step,
          avatarMode,
          selectedAvatarId,
          selectedAvatarName,
          twinAvatarId,
          photoAvatarId,
          bgPreview,
          bgFile: bgFileData,
          bgAssetId,
          script,
          scriptLanguage,
          scriptTone,
          allowEmotionTags,
          propertyBrief,
          selectedVoiceId,
          aspectRatio,
          videoId,
          videoStatus,
          videoUrl,
          thumbnailUrl,
        };

        if (!cancelled) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        }
      } catch (err) {
        console.error("Failed to persist real estate state:", err);
      }
    }

    saveState();
    return () => { cancelled = true; };
  }, [
    isRestored,
    step,
    avatarMode,
    selectedAvatarId,
    selectedAvatarName,
    twinAvatarId,
    photoAvatarId,
    bgPreview,
    bgFile,
    bgAssetId,
    script,
    scriptLanguage,
    scriptTone,
    allowEmotionTags,
    propertyBrief,
    selectedVoiceId,
    aspectRatio,
    videoId,
    videoStatus,
    videoUrl,
    thumbnailUrl,
  ]);

  const { avatars, photoAvatars, voices, loading: heygenLoading } = useHeygen();

  const twinFileRef = useRef(null);
  const consentFileRef = useRef(null);
  const bgFileRef = useRef(null);

  const filteredAvatars = avatars.filter(
    (a) =>
      a.avatar_name?.toLowerCase().includes(avatarSearch.toLowerCase()) ||
      a.gender?.toLowerCase().includes(avatarSearch.toLowerCase())
  );

  const filteredVoices = voices.filter((v) => {
    const s = voiceSearch.toLowerCase();
    return (
      v.name?.toLowerCase().includes(s) ||
      v.language?.toLowerCase().includes(s) ||
      v.language_id?.toLowerCase().includes(s)
    );
  });

  // Poll photo avatar generation status
  useEffect(() => {
    if (!photoGenId || photoGenStatus !== "generating") return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/avatar/generation-status?generation_id=${photoGenId}`);
        const data = await res.json();
        const isDone = (data.status === "success" || data.status === "completed") && !!data.image_url;
        if (isDone) {
          setPhotoImageKey(data.image_key);
          setPhotoImageUrl(data.image_url);
          if (data.image_url_list && data.image_key_list) {
            setPhotoVariations(data.image_url_list.map((url, i) => ({
              url,
              key: data.image_key_list[i]
            })));
          }
          setPhotoGenStatus("success");
          clearInterval(iv);
        } else if (data.status === "failed") {
          setPhotoGenStatus("failed");
          toast.error("Avatar generation failed");
          clearInterval(iv);
        }
      } catch (e) { console.error("photo gen poll:", e); }
    }, 5000);
    return () => clearInterval(iv);
  }, [photoGenId, photoGenStatus]);

  // Poll photo avatar group training status
  useEffect(() => {
    if (!photoGroupId || photoGroupStatus !== "training") return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/avatar/training-status?group_id=${photoGroupId}`);
        const data = await res.json();
        if (data.status === "ready" || data.status === "completed") {
          setPhotoGroupStatus("ready");
          toast.success("Avatar trained and ready!");
          setPhotoSubStep(2);
          clearInterval(iv);
        } else if (data.status === "failed") {
          setPhotoGroupStatus("failed");
          toast.error("Avatar training failed");
          clearInterval(iv);
        }
      } catch (e) { console.error("photo train poll:", e); }
    }, 15000);
    return () => clearInterval(iv);
  }, [photoGroupId, photoGroupStatus]);

  // Poll individual look generation statuses
  useEffect(() => {
    const pending = photoLooks.filter((l) => l.status === "generating");
    if (pending.length === 0) return;
    const iv = setInterval(async () => {
      for (const look of pending) {
        try {
          const res = await fetch(`/api/avatar/generation-status?generation_id=${look.generation_id}`);
          const data = await res.json();
          const isDone = (data.status === "success" || data.status === "completed") && !!data.image_url;
          if (isDone || data.status === "failed") {
            setPhotoLooks((prev) =>
              prev.map((l) =>
                l.generation_id === look.generation_id
                  ? { ...l, status: isDone ? "success" : "failed", image_url: data.image_url, image_key: data.image_key }
                  : l
              )
            );
          }
        } catch (e) { console.error("look poll:", e); }
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [photoLooks]);

  // Poll twin training status
  useEffect(() => {
    if (!twinId || twinStatus !== "training") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/real-estate-video/train-twin?twin_id=${twinId}`);
        const data = await res.json();
        setTrainingProgress(data.status);

        if (data.status === "completed" || data.avatar_id) {
          setTwinAvatarId(data.avatar_id);
          setTwinStatus("ready");
          setSelectedAvatarId(data.avatar_id);
          toast.success("Your Digital Twin is ready!", {
            description: "You can now generate your real estate video.",
          });
          clearInterval(interval);
        } else if (data.status === "failed") {
          setTwinStatus("failed");
          toast.error("Digital Twin training failed", {
            description: "Please try uploading the video again.",
          });
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Twin polling error:", err);
      }
    }, 15000); // Check every 15s (training takes 15-30 min)

    return () => clearInterval(interval);
  }, [twinId, twinStatus]);

  // Poll video status
  useEffect(() => {
    if (!videoId || videoStatus === "completed" || videoStatus === "failed") return;

    setPolling(true);
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/real-estate-video/status?video_id=${videoId}`);
        const data = await res.json();
        setVideoStatus(data.status);

        if (data.status === "completed") {
          setVideoUrl(data.video_url);
          setThumbnailUrl(data.thumbnail_url);
          setPolling(false);
          toast.success("🎬 Your video is ready!");
          clearInterval(interval);
        } else if (data.status === "failed") {
          setPolling(false);
          setError("Video generation failed. Please try again.");
          toast.error("Video generation failed");
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Video polling error:", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [videoId, videoStatus]);

  useEffect(() => {
    if (!isRestored || videoUrl) return;
    let active = true;

    async function loadRecentVideo() {
      try {
        const res = await fetch("/api/assets?type=clip");
        const data = await res.json();
        if (!res.ok) return;
        const recent = (data.assets || []).find((a) => a?.metadata?.context === "real-estate-video");
        if (active && recent?.url) {
          setVideoUrl(recent.url);
          setVideoStatus("completed");
        }
      } catch (err) {
        console.error("Failed to load recent real estate video:", err);
      }
    }

    loadRecentVideo();
    return () => { active = false; };
  }, [isRestored, videoUrl]);

  // --- Handlers ---

  async function handleTwinUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Please upload a video file (MP4, MOV, WebM)");
      return;
    }
    setTwinFile(file);
    if (!twinName) {
      setTwinName(file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "));
    }
  }

  async function handleConsentUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Please upload a video file (MP4, MOV, WebM)");
      return;
    }
    setConsentFile(file);
  }

  async function handleStartTwinTraining() {
    if (!twinFile || !consentFile) {
      toast.error("Both training footage and consent video are required.");
      return;
    }
    setTwinStatus("uploading");

    try {
      const formData = new FormData();
      formData.append("file", twinFile);
      formData.append("consent", consentFile);
      formData.append("name", twinName || "My RE Avatar");

      const res = await fetch("/api/real-estate-video/train-twin", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Training failed to start");

      setTwinId(data.twin_id);
      setTwinStatus("training");
      setTrainingProgress("pending");
      toast.info("Training started!", {
        description: "This takes 15–30 minutes. You can come back later.",
      });
    } catch (err) {
      setTwinStatus("failed");
      toast.error("Failed to start training", { description: err.message });
    }
  }

  async function handleBgFileChange(e) {
    const file = e.target.files?.[0];
    if (file) uploadBackground(file);
  }

  async function handleAssetSelect(asset) {
    try {
      const response = await fetch(asset.url);
      const blob = await response.blob();
      const file = new File([blob], asset.name, { type: blob.type });
      uploadBackground(file);
    } catch (error) {
      toast.error("Failed to load asset from library");
    }
  }

  async function uploadBackground(file) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Please upload a JPEG, PNG, or WebP image");
      return;
    }

    setBgFile(file);
    setBgPreview(URL.createObjectURL(file));
    setBgAssetId(null);
    setBgUploading(true);

    try {
      const assetForm = new FormData();
      assetForm.append("file", file);
      assetForm.append("type", "property");
      assetForm.append("name", "Property Photo");
      fetch("/api/assets/upload", { method: "POST", body: assetForm }).catch(() => {});

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/real-estate-video/upload-bg", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Background upload failed");

      setBgAssetId(data.asset_id);
      toast.success("Background uploaded ✅");
    } catch (err) {
      toast.error("Background upload failed", { description: err.message });
      setBgFile(null);
      setBgPreview(null);
    } finally {
      setBgUploading(false);
    }
  }

  async function handleGenerate() {
    if (!selectedAvatarId || !bgAssetId || !script.trim() || !selectedVoiceId) return;

    setGenerating(true);
    setError(null);
    setVideoId(null);
    setVideoUrl(null);
    setVideoStatus(null);

    try {
      const res = await fetch("/api/real-estate-video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatar_id: selectedAvatarId,
          bg_asset_id: bgAssetId,
          script: script.trim(),
          voice_id: selectedVoiceId,
          aspect_ratio: aspectRatio,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setVideoId(data.video_id);
      setVideoStatus("processing");
      toast.success("Video generation started!", {
        description: "This takes 2–5 minutes. We'll show it when it's ready.",
      });
    } catch (err) {
      setError(err.message);
      toast.error("Generation failed", { description: err.message });
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateScript() {
    setGeneratingScript(true);
    try {
      const fd = new FormData();
      if (bgFile) fd.append("locationImage", bgFile);
      fd.append("language", scriptLanguage);
      fd.append("tone", scriptTone);
      fd.append("allowEmotionTags", allowEmotionTags ? "true" : "false");

      Object.entries(propertyBrief).forEach(([key, value]) => {
        if (value) fd.append(key, value);
      });

      const res = await fetch("/api/real-estate-video/generate-script", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Script generation failed");
      if (data.script?.fullScript) setScript(data.script.fullScript);
      else if (typeof data.script === "string") setScript(data.script);
      if (data.scripts?.length) setScript(data.scripts[0]?.fullScript || data.scripts[0] || "");
      toast.success("Script generated!");
    } catch (err) {
      toast.error("Script generation failed", { description: err.message });
    } finally {
      setGeneratingScript(false);
    }
  }

  function resetVideo() {
    setVideoId(null);
    setVideoStatus(null);
    setVideoUrl(null);
    setThumbnailUrl(null);
    setError(null);
    setPolling(false);
  }

  const effectiveAvatarId =
    avatarMode === "twin" ? twinAvatarId : selectedAvatarId;

  const canGenerate =
    !!effectiveAvatarId &&
    !!bgAssetId &&
    script.trim().length >= 10 &&
    !!selectedVoiceId &&
    !generating;

  // Step validity
  const step1Valid =
    avatarMode === "library"
      ? !!selectedAvatarId
      : avatarMode === "photo"
      ? photoSubStep === 3 && !!selectedAvatarId
      : twinStatus === "ready" && !!twinAvatarId;
  const step2Valid = !!bgAssetId;
  const step3Valid = script.trim().length >= 10 && !!selectedVoiceId;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center shadow-md">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Real Estate Video</h1>
          <p className="text-sm text-muted-foreground">
            Generate a professional spokesperson video for any location photo — powered by HeyGen.
          </p>
        </div>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-1 mb-8 mt-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <button
              onClick={() => {
                if (i < step || (i === 1 && step1Valid) || (i === 2 && step1Valid && step2Valid))
                  setStep(i);
              }}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                step === i
                  ? "gradient-bg text-white shadow-md"
                  : i < step
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground bg-muted/50"
              }`}
            >
              {i < step ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <span className="w-4 h-4 rounded-full border text-[10px] flex items-center justify-center font-bold">
                  {i + 1}
                </span>
              )}
              <span className="hidden sm:inline">{s}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div
                className={`h-px flex-1 transition-colors ${
                  i < step ? "bg-primary/40" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* ─── STEP 0: Avatar ─── */}
      {step === 0 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Tabs value={avatarMode} onValueChange={(v) => { setAvatarMode(v); setSelectedAvatarId(null); }}>
            <TabsList className="mb-4">
              <TabsTrigger value="library" className="cursor-pointer gap-2">
                <User className="w-4 h-4" />
                Use a Presenter
              </TabsTrigger>
              <TabsTrigger value="twin" className="cursor-pointer gap-2">
                <Sparkles className="w-4 h-4" />
                Use My Face
              </TabsTrigger>
              <TabsTrigger value="photo" className="cursor-pointer gap-2">
                <Wand2 className="w-4 h-4" />
                AI Photo Avatar
              </TabsTrigger>
            </TabsList>

            {/* Library Avatar Tab */}
            <TabsContent value="library">
              <div className="space-y-3">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex gap-2.5">
                  <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    These are HeyGen's professional avatars — full body, natural gestures, facial expressions. Pick one to represent your property.
                  </p>
                </div>

                <Input
                  placeholder="Search by name or gender..."
                  value={avatarSearch}
                  onChange={(e) => setAvatarSearch(e.target.value)}
                  className="max-w-sm"
                />

                {heygenLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {[...Array(8)].map((_, i) => (
                      <Card key={i} className="border-border/50 overflow-hidden">
                        <CardContent className="p-0">
                          <Skeleton className="aspect-3/4 w-full" />
                          <div className="p-2 space-y-1">
                            <Skeleton className="h-3 w-3/4" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-115 overflow-y-auto pr-1">
                    {filteredAvatars.map((avatar, i) => (
                      <Card
                        key={`${avatar.avatar_id}-${i}`}
                        onClick={() => {
                          setSelectedAvatarId(avatar.avatar_id);
                          setSelectedAvatarName(avatar.avatar_name);
                        }}
                        className={`group cursor-pointer overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg ${
                          selectedAvatarId === avatar.avatar_id
                            ? "ring-2 ring-primary border-primary"
                            : "border-border/50"
                        }`}
                      >
                        <CardContent className="p-0">
                          <div className="aspect-3/4 relative bg-linear-to-br from-primary/10 to-accent/10 flex items-center justify-center overflow-hidden">
                            {avatar.preview_image_url ? (
                              <img
                                src={avatar.preview_image_url}
                                alt={avatar.avatar_name}
                                className="w-full h-full object-cover object-top"
                              />
                            ) : (
                              <User className="w-12 h-12 text-primary/30" />
                            )}
                            {selectedAvatarId === avatar.avatar_id && (
                              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow">
                                <CheckCircle2 className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="p-2">
                            <p className="text-xs font-medium truncate">{avatar.avatar_name}</p>
                            {avatar.gender && (
                              <Badge variant="secondary" className="text-[10px] mt-1 h-4 px-1.5">
                                {avatar.gender}
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {filteredAvatars.length === 0 && (
                      <div className="col-span-4 text-center py-10 text-muted-foreground">
                        No avatars found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Digital Twin Tab */}
            <TabsContent value="twin">
              <div className="space-y-4">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex gap-2.5">
                  <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><strong className="text-foreground">Record a 2–5 minute video</strong> of yourself speaking naturally (any topic, just keep talking).</p>
                    <p>HeyGen will train a <strong className="text-foreground">full-body avatar with your face</strong> — gestures, expressions, everything. Training takes 15–30 minutes.</p>
                    <p className="text-[11px]">📸 Good lighting • Clear audio • Front-facing • No cuts</p>
                  </div>
                </div>

                {/* Upload areas */}
                <input
                  ref={twinFileRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  onChange={handleTwinUpload}
                />
                <input
                  ref={consentFileRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  onChange={handleConsentUpload}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Training Video */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">1. Training Footage (2-5 mins)</label>
                    {!twinFile ? (
                      <button
                        onClick={() => twinFileRef.current?.click()}
                        className="w-full border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-all bg-muted/20"
                      >
                        <Video className="w-8 h-8 text-primary/40" />
                        <p className="font-medium text-[13px]">Select training video</p>
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                        <Video className="w-4 h-4 text-primary shrink-0" />
                        <p className="text-xs font-medium truncate flex-1">{twinFile.name}</p>
                        {!twinStatus && (
                          <button onClick={() => setTwinFile(null)} className="text-muted-foreground hover:text-foreground">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Consent Video */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">2. Consent Statement</label>
                    {!consentFile ? (
                      <button
                        onClick={() => consentFileRef.current?.click()}
                        className="w-full border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-all bg-muted/20"
                      >
                        <Camera className="w-8 h-8 text-primary/40" />
                        <p className="font-medium text-[13px]">Select consent video</p>
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                        <Camera className="w-4 h-4 text-primary shrink-0" />
                        <p className="text-xs font-medium truncate flex-1">{consentFile.name}</p>
                        {!twinStatus && (
                          <button onClick={() => setConsentFile(null)} className="text-muted-foreground hover:text-foreground">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {(twinFile || consentFile) && (
                  <div className="space-y-3 pt-2">
                    <Input
                      placeholder="Name your avatar (e.g. Raj - Sales Lead)"
                      value={twinName}
                      onChange={(e) => setTwinName(e.target.value)}
                    />

                    {/* Training status */}
                    {twinStatus === "uploading" && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        Uploading video to HeyGen...
                      </div>
                    )}
                    {twinStatus === "training" && (
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                          <Clock className="w-4 h-4 animate-pulse" />
                          Training in progress — {trainingProgress}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          This takes 15–30 minutes. You can close this tab and come back. We'll alert you when it's ready.
                        </p>
                      </div>
                    )}
                    {twinStatus === "ready" && (
                      <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        Your Digital Twin is ready! Proceed to the next step.
                      </div>
                    )}
                    {twinStatus === "failed" && (
                      <div className="text-sm text-destructive">
                        Training failed. Please try a different video.
                      </div>
                    )}

                    {!twinStatus && (
                      <Button
                        onClick={handleStartTwinTraining}
                        className="gradient-bg text-white shadow-md cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Start Training
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ─── AI Photo Avatar Tab ─── */}
            <TabsContent value="photo">
              <div className="space-y-4">
                <Tabs defaultValue="generate" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="generate">Generate New</TabsTrigger>
                    <TabsTrigger value="library">My Library ({photoAvatars.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="generate" className="space-y-5 animate-in slide-in-from-left-2 duration-300">
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex gap-2.5">
                      <Wand2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        Generate a <strong className="text-foreground">custom AI avatar photo</strong> using text prompts — choose age, gender, style, and appearance.
                      </p>
                    </div>

                {/* Sub-step indicator */}
                <div className="flex gap-2 text-xs">
                  {["Generate", "Train", "Add Looks", "Pick"].map((s, i) => (
                    <span key={s} className={`px-2 py-1 rounded-full font-medium transition-all ${
                      photoSubStep === i ? "gradient-bg text-white" :
                      photoSubStep > i ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}>{i + 1}. {s}</span>
                  ))}
                </div>

                {/* ── Sub-step 0: Generate form ── */}
                {photoSubStep === 0 && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {/* Name */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Avatar Name</label>
                        <Input
                          value={photoForm.name}
                          onChange={(e) => setPhotoForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="e.g. Priya"
                        />
                      </div>
                      {/* Age */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Age Group</label>
                        <Select value={photoForm.age} onValueChange={(v) => setPhotoForm((f) => ({ ...f, age: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Young Adult", "Early Middle Age", "Late Middle Age", "Senior", "Unspecified"].map((a) => (
                              <SelectItem key={a} value={a}>{a}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Gender */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Gender</label>
                        <Select value={photoForm.gender} onValueChange={(v) => setPhotoForm((f) => ({ ...f, gender: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Woman", "Man", "Unspecified"].map((g) => (
                              <SelectItem key={g} value={g}>{g}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Ethnicity */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Ethnicity</label>
                        <Select value={photoForm.ethnicity} onValueChange={(v) => setPhotoForm((f) => ({ ...f, ethnicity: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["White", "Black", "Asian", "Asian American", "South Asian", "Hispanic", "Middle Eastern", "Pacific Islander", "Mixed", "Unspecified"].map((e) => (
                              <SelectItem key={e} value={e}>{e}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Pose */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Pose</label>
                        <Select value={photoForm.pose} onValueChange={(v) => setPhotoForm((f) => ({ ...f, pose: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["half_body", "close_up", "full_body"].map((p) => (
                              <SelectItem key={p} value={p}>{p.replace("_", " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Style */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Style</label>
                        <Select value={photoForm.style} onValueChange={(v) => setPhotoForm((f) => ({ ...f, style: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Realistic", "Pixar", "Cinematic", "Vintage", "Noir", "Cyberpunk", "Unspecified"].map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Extended customization row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Skin Tone</label>
                        <Select value={photoForm.skinTone} onValueChange={(v) => setPhotoForm((f) => ({ ...f, skinTone: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select skin tone" /></SelectTrigger>
                          <SelectContent>
                            {["Fair", "Light", "Wheatish", "Medium", "Olive", "Tan", "Dark Brown", "Deep", "Unspecified"].map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Hair (color &amp; style)</label>
                        <Input
                          value={photoForm.hair}
                          onChange={(e) => setPhotoForm((f) => ({ ...f, hair: e.target.value }))}
                          placeholder="e.g., Long black wavy, Short cropped grey"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Dressing Style</label>
                        <Select value={photoForm.dressingStyle} onValueChange={(v) => setPhotoForm((f) => ({ ...f, dressingStyle: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select style" /></SelectTrigger>
                          <SelectContent>
                            {["Casual", "Smart Casual", "Business Formal", "Business Casual", "Traditional / Ethnic", "Luxury", "Sporty", "Street Style", "Unspecified"].map((d) => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Accessories</label>
                        <Input
                          value={photoForm.accessories}
                          onChange={(e) => setPhotoForm((f) => ({ ...f, accessories: e.target.value }))}
                          placeholder="e.g., Gold earrings, watch, glasses"
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground">Place / Background Setting</label>
                        <Input
                          value={photoForm.place}
                          onChange={(e) => setPhotoForm((f) => ({ ...f, place: e.target.value }))}
                          placeholder="e.g., Modern real estate office, luxury apartment lobby"
                        />
                      </div>
                    </div>

                    {/* Appearance */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Appearance Description</label>
                      <Textarea
                        value={photoForm.appearance}
                        onChange={(e) => setPhotoForm((f) => ({ ...f, appearance: e.target.value }))}
                        placeholder="A professional real estate agent in a navy blazer, standing confidently in a modern office..."
                        className="min-h-20 resize-none text-sm"
                        maxLength={1000}
                      />
                      <p className="text-[10px] text-muted-foreground text-right">{photoForm.appearance.length}/1000</p>
                    </div>

                    {/* Extra notes */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Extra Notes (expression, mood, makeup)</label>
                      <Input
                        value={photoForm.extraNotes}
                        onChange={(e) => setPhotoForm((f) => ({ ...f, extraNotes: e.target.value }))}
                        placeholder="e.g., Warm confident smile, minimal makeup, approachable"
                      />
                    </div>

                    {photoGenStatus === "failed" && (
                      <p className="text-sm text-destructive">Generation failed. Please try again.</p>
                    )}

                    <Button
                      className="gradient-bg text-white shadow-md cursor-pointer"
                      disabled={!photoForm.appearance || photoGenStatus === "generating"}
                      onClick={async () => {
                        setPhotoGenStatus("generating");
                        setPhotoGenId(null);
                        try {
                          const res = await fetch("/api/avatar/generate-photo", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(photoForm),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error);
                          setPhotoGenId(data.generation_id);
                          toast.info("Generating your avatar photo...", { description: "Usually takes 30–60 seconds." });
                        } catch (err) {
                          setPhotoGenStatus("failed");
                          toast.error("Failed to generate avatar", { description: err.message });
                        }
                      }}
                    >
                      {photoGenStatus === "generating" ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating avatar...</>
                      ) : (
                        <><Wand2 className="w-4 h-4 mr-2" />Generate Avatar Photo</>
                      )}
                    </Button>

                    {/* Show preview once done — with 4 variations if available */}
                    {photoGenStatus === "success" && (photoImageUrl || photoVariations.length > 0) && (
                      <div className="space-y-4">
                        <p className="text-xs font-medium">Select your favorite variation:</p>
                        <div className="grid grid-cols-2 gap-3">
                          {(photoVariations.length > 0 ? photoVariations : [{url: photoImageUrl, key: photoImageKey}]).map((v, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setPhotoImageUrl(v.url);
                                setPhotoImageKey(v.key);
                              }}
                              className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-square group ${
                                photoImageUrl === v.url ? "border-primary ring-2 ring-primary/40 shadow-lg" : "border-border hover:border-primary/50"
                              }`}
                            >
                              <img src={v.url} alt={`Variation ${i + 1}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                              {photoImageUrl === v.url && (
                                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                  <CheckCircle2 className="w-3 h-3 text-white" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                        <Button
                          className="gradient-bg text-white shadow-md cursor-pointer"
                          onClick={async () => {
                            setPhotoGroupStatus("creating");
                            try {
                              // 1. Create the Group
                              const res = await fetch("/api/avatar/create-group", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  name: photoForm.name,
                                  image_key: photoImageKey,
                                  generation_id: photoGenId
                                }),
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error);
                              
                              const groupId = data.group_id;
                              setPhotoGroupId(groupId);
                              setPhotoAvatarId(data.avatar_id);

                              // 2. Add ALL variations as looks (v2 requires looks for training to succeed)
                              if (photoVariations.length > 0) {
                                const lookRes = await fetch("/api/avatar/add-looks", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    group_id: groupId,
                                    image_keys: photoVariations.map(v => v.key),
                                    name: "Initial Variations",
                                    generation_id: photoGenId
                                  }),
                                });
                                if (!lookRes.ok) console.warn("Failed to add initial looks, but continuing to training...");
                              }

                              // 3. Brief delay to let HeyGen process the looks
                              await new Promise(r => setTimeout(r, 2000));

                              // 4. Start training
                              const tr = await fetch("/api/avatar/train-group", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ group_id: groupId }),
                              });
                              
                              if (!tr.ok) {
                                const trData = await tr.json();
                                throw new Error(trData.error || "Training failed to start");
                              }
                              
                              setPhotoGroupStatus("training");
                              setPhotoSubStep(1);
                              toast.info("Training started!", { description: "This takes ~15 minutes. We'll notify you." });
                            } catch (err) {
                              console.error("Training flow error:", err);
                              setPhotoGroupStatus("failed");
                              toast.error("Failed to create/train group", { description: err.message });
                            }
                          }}
                          disabled={photoGroupStatus === "creating"}
                        >
                          {photoGroupStatus === "creating" ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating group...</>
                          ) : (
                            <><Sparkles className="w-4 h-4 mr-2" />Create Group & Train Avatar</>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Sub-step 1: Training ── */}
                {photoSubStep === 1 && (
                  <div className="space-y-4">
                    <div className="flex gap-4 items-start">
                      <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-border shrink-0">
                        {photoImageUrl && <img src={photoImageUrl} alt="avatar" className="w-full h-full object-cover" />}
                      </div>
                      <div className="space-y-2 flex-1">
                        <p className="text-sm font-semibold">{photoForm.name}</p>
                        {photoGroupStatus === "training" && (
                          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
                            <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                              <Clock className="w-4 h-4 animate-pulse" />
                              Training avatar model...
                            </div>
                            <p className="text-xs text-muted-foreground">Takes ~15 minutes. Polling every 15 seconds.</p>
                          </div>
                        )}
                        {photoGroupStatus === "ready" && (
                          <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                            <CheckCircle2 className="w-4 h-4" />
                            Training complete! Continue below.
                          </div>
                        )}
                        {photoGroupStatus === "failed" && (
                          <p className="text-sm text-destructive">Training failed. Please start again.</p>
                        )}
                      </div>
                    </div>
                    {photoGroupStatus === "ready" && (
                      <Button className="gradient-bg text-white shadow-md cursor-pointer" onClick={() => setPhotoSubStep(2)}>
                        Continue to Add Looks →
                      </Button>
                    )}
                  </div>
                )}

                {/* ── Sub-step 2: Generate additional looks ── */}
                {photoSubStep === 2 && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <p className="text-xs text-muted-foreground">
                        <strong className="text-foreground">Optional:</strong> Generate more looks (outfits/settings) for your avatar using a text prompt, or skip and use the base image.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. White shirt, front-facing, studio background"
                        value={photoLookPrompt}
                        onChange={(e) => setPhotoLookPrompt(e.target.value)}
                        className="flex-1 text-sm"
                      />
                      <Button
                        variant="outline"
                        disabled={!photoLookPrompt || generatingLook}
                        className="cursor-pointer shrink-0"
                        onClick={async () => {
                          if (!photoLookPrompt || !photoGroupId) return;
                          setGeneratingLook(true);
                          try {
                            const res = await fetch("/api/avatar/generate-looks", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                group_id: photoGroupId,
                                prompt: photoLookPrompt,
                                orientation: photoForm.orientation,
                                pose: photoForm.pose,
                                style: photoForm.style,
                              }),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error);
                            setPhotoLooks((prev) => {
                              // Prevent adding double if same generation_id is returned
                              if (prev.some(l => l.generation_id === data.generation_id)) return prev;
                              return [...prev, { generation_id: data.generation_id, status: "generating", image_url: null, image_key: null }];
                            });
                            setPhotoLookPrompt("");
                            toast.info("Look generation started...");
                          } catch (err) {
                            toast.error("Look generation failed", { description: err.message });
                          } finally {
                            setGeneratingLook(false);
                          }
                        }}
                      >
                        {generatingLook ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </Button>
                    </div>

                    {/* Looks grid */}
                    {photoLooks.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {photoLooks.map((look, i) => (
                          <div key={look.generation_id || `generating-${i}`} className="rounded-lg border border-border overflow-hidden aspect-square bg-muted flex items-center justify-center relative">
                            {look.status === "generating" ? (
                              <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            ) : look.status === "success" && look.image_url ? (
                              <img src={look.image_url} alt={`Look ${i + 1}`} className="w-full h-full object-cover" />
                            ) : (
                              <X className="w-5 h-5 text-destructive" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <Button className="gradient-bg text-white shadow-md cursor-pointer" onClick={() => setPhotoSubStep(3)}>
                      Continue to Pick Look →
                    </Button>
                  </div>
                )}

                {/* ── Sub-step 3: Pick a look ── */}
                {photoSubStep === 3 && (
                  <div className="space-y-4">
                    <p className="text-sm font-medium">Select the look you want to use in your video:</p>

                    {/* Base avatar image */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {/* Base */}
                      <button
                        onClick={() => {
                          setSelectedLookKey(photoImageKey);
                          setSelectedAvatarId(photoAvatarId);
                        }}
                        className={`relative rounded-lg border-2 overflow-hidden aspect-square transition-all ${selectedLookKey === photoImageKey ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50"}`}
                      >
                        {photoImageUrl && <img src={photoImageUrl} alt="Base avatar" className="w-full h-full object-cover" />}
                        {selectedLookKey === photoImageKey && (
                          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-primary drop-shadow" />
                          </div>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 py-0.5">
                          <p className="text-[9px] text-white text-center">Base</p>
                        </div>
                      </button>

                      {/* Additional looks */}
                      {photoLooks.filter((l) => l.status === "success" && l.image_url).map((look, i) => (
                        <button
                          key={`${look.generation_id}-${i}`}
                          onClick={() => {
                            setSelectedLookKey(look.image_key);
                            setSelectedAvatarId(photoAvatarId);
                          }}
                          className={`relative rounded-lg border-2 overflow-hidden aspect-square transition-all ${selectedLookKey === look.image_key ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50"}`}
                        >
                          <img src={look.image_url} alt={`Look ${i + 1}`} className="w-full h-full object-cover" />
                          {selectedLookKey === look.image_key && (
                            <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                              <CheckCircle2 className="w-6 h-6 text-primary drop-shadow" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>

                    {selectedLookKey && (
                      <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        Look selected! Click "Continue to Background" below.
                      </div>
                    )}
                    </div>
                  )}
                  </TabsContent>

                  <TabsContent value="library" className="space-y-4 animate-in slide-in-from-right-2 duration-300">
                    {photoAvatars.length === 0 ? (
                      <div className="text-center py-10 space-y-3">
                        <Users className="w-10 h-10 text-muted-foreground mx-auto opacity-20" />
                        <p className="text-sm text-muted-foreground">No custom avatars found. Generate one first!</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 max-h-100 overflow-y-auto p-1">
                        {photoAvatars.map((group, i) => (
                          <button
                            key={`${group.group_id}-${i}`}
                            onClick={() => {
                              const avatarId = group.avatar_id || group.avatar_list?.[0]?.avatar_id;
                              setSelectedAvatarId(avatarId);
                              toast.success(`Selected ${group.name || "Custom Avatar"}`);
                            }}
                            type="button"
                            className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-square group ${
                              selectedAvatarId === (group.avatar_id || group.avatar_list?.[0]?.avatar_id)
                                ? "border-primary ring-2 ring-primary/40 shadow-lg"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <img
                              src={group.avatar_list?.[0]?.preview_image || group.preview_image || "/placeholder-avatar.png"}
                              alt={group.name}
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-2">
                              <p className="text-[10px] font-medium text-white truncate">{group.name || "Untitled"}</p>
                            </div>
                            {selectedAvatarId === (group.avatar_id || group.avatar_list?.[0]?.avatar_id) && (
                              <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                <CheckCircle2 className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

            </TabsContent>
          </Tabs>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => setStep(1)}
              disabled={!step1Valid}
              className="gradient-bg text-white shadow-md cursor-pointer"
            >
              Continue to Background →
            </Button>
          </div>
        </div>
      )}

      {/* ─── STEP 1: Property Background ─── */}
      {step === 1 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div>
            <h2 className="text-base font-semibold mb-1">Upload Property Background</h2>
            <p className="text-sm text-muted-foreground">
              Upload a photo of the real estate property. The avatar will appear in front of it.
            </p>
          </div>

          <input
            ref={bgFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleBgFileChange}
          />

          {!bgPreview ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => bgFileRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-foreground transition-colors group bg-muted/10 cursor-pointer"
              >
                <Upload className="w-10 h-10 group-hover:text-primary transition-colors" />
                <div className="text-center">
                  <p className="font-semibold text-sm">Upload photo</p>
                  <p className="text-[11px] text-muted-foreground mt-1">JPEG, PNG, WebP</p>
                </div>
              </button>

              <AssetSelector 
                type="products"
                title="Select Background"
                onSelect={handleAssetSelect}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden border border-border aspect-video bg-black">
                <img
                  src={bgPreview}
                  alt="Property background"
                  className="w-full h-full object-cover"
                />
                {bgUploading && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                    <p className="text-white text-sm">Uploading to HeyGen...</p>
                  </div>
                )}
                {bgAssetId && (
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-green-500 text-white border-0">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Uploaded
                    </Badge>
                  </div>
                )}
                <button
                  onClick={() => {
                    setBgFile(null);
                    setBgPreview(null);
                    setBgAssetId(null);
                    if (bgFileRef.current) bgFileRef.current.value = "";
                  }}
                  className="absolute top-3 left-3 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {bgAssetId && (
                <p className="text-xs text-muted-foreground">
                  Asset ID: <span className="font-mono">{bgAssetId}</span>
                </p>
              )}

              {!bgAssetId && !bgUploading && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bgFileRef.current?.click()}
                  className="cursor-pointer"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Try a different image
                </Button>
              )}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(0)} className="cursor-pointer">
              ← Back
            </Button>
            <Button
              onClick={() => setStep(2)}
              disabled={!step2Valid}
              className="gradient-bg text-white shadow-md cursor-pointer"
            >
              Continue to Script →
            </Button>
          </div>
        </div>
      )}

      {/* ─── STEP 2: Script & Voice ─── */}
      {step === 2 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div>
            <h2 className="text-base font-semibold mb-1">Script & Voice</h2>
            <p className="text-sm text-muted-foreground">
              Write what your avatar will say. Choose a voice that fits your brand.
            </p>
          </div>

          {/* Property brief / questionnaire */}
          <div className="rounded-xl border border-border/50 p-4 bg-card/50 space-y-3">
            <h3 className="text-sm font-semibold">Property Brief (for AI script)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                placeholder="Location (e.g., Gurgaon Sector 49)"
                value={propertyBrief.location}
                onChange={(e) => setPropertyBrief((p) => ({ ...p, location: e.target.value }))}
              />
              <Input
                placeholder="Property type (e.g., 3BHK apartment)"
                value={propertyBrief.propertyType}
                onChange={(e) => setPropertyBrief((p) => ({ ...p, propertyType: e.target.value }))}
              />
              <Input
                placeholder="Price (e.g., ₹1.2 Cr)"
                value={propertyBrief.price}
                onChange={(e) => setPropertyBrief((p) => ({ ...p, price: e.target.value }))}
              />
              <Input
                placeholder="Bedrooms (e.g., 3)"
                value={propertyBrief.bedrooms}
                onChange={(e) => setPropertyBrief((p) => ({ ...p, bedrooms: e.target.value }))}
              />
              <Input
                placeholder="Bathrooms (e.g., 2)"
                value={propertyBrief.bathrooms}
                onChange={(e) => setPropertyBrief((p) => ({ ...p, bathrooms: e.target.value }))}
              />
              <Input
                placeholder="Area/size (e.g., 1650 sq ft)"
                value={propertyBrief.area}
                onChange={(e) => setPropertyBrief((p) => ({ ...p, area: e.target.value }))}
              />
            </div>
            <Textarea
              placeholder="Key features (e.g., floor-to-ceiling windows, park view, modular kitchen)"
              className="min-h-20 resize-none text-sm"
              value={propertyBrief.keyFeatures}
              onChange={(e) => setPropertyBrief((p) => ({ ...p, keyFeatures: e.target.value }))}
            />
            <Textarea
              placeholder="Amenities (e.g., gym, pool, clubhouse, parking)"
              className="min-h-20 resize-none text-sm"
              value={propertyBrief.amenities}
              onChange={(e) => setPropertyBrief((p) => ({ ...p, amenities: e.target.value }))}
            />

            <div className="flex gap-2 flex-wrap">
              {LANGUAGES.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setScriptLanguage(l.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    scriptLanguage === l.id ? "gradient-bg text-white" : "border border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setScriptTone(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    scriptTone === t.id ? "gradient-bg text-white" : "border border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={allowEmotionTags} onCheckedChange={setAllowEmotionTags} />
              <span className="text-xs text-muted-foreground">Allow emotion tags like {{happy}} or {{sad}}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateScript}
              disabled={generatingScript}
              className="cursor-pointer text-xs w-full"
            >
              {generatingScript ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
              ✨ AI Generate Script
            </Button>
          </div>

          {/* Script */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Mic className="w-4 h-4 text-muted-foreground" />
              Script
            </label>
            <Textarea
              placeholder="Welcome to this stunning 3BHK apartment in the heart of South Delhi. With floor-to-ceiling windows and premium fittings, this is luxury living redefined..."
              className="min-h-35 resize-none text-sm"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              maxLength={3000}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{script.length < 10 ? `${10 - script.length} more characters needed` : "✅ Script ready"}</span>
              <span>{script.length}/3000</span>
            </div>
          </div>

          {/* Voice */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Voice</label>
            <Input
              placeholder="Search voice (e.g. Hindi, English, male...)"
              className="max-w-sm"
              value={voiceSearch}
              onChange={(e) => setVoiceSearch(e.target.value)}
            />
            <div className="flex gap-1.5">
              {["English", "Hindi", "Male", "Female"].map((q) => (
                <button
                  key={q}
                  onClick={() => setVoiceSearch(q)}
                  className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
                >
                  {q}
                </button>
              ))}
            </div>
            <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId}>
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={voiceSearch ? `${filteredVoices.length} voices found...` : "Pick a voice..."}
                />
              </SelectTrigger>
              <SelectContent className="max-h-87.5">
                <div className="p-2 text-[10px] text-muted-foreground border-b">
                  {voiceSearch ? `Search results: ${filteredVoices.length}` : `All voices (${voices.length})`}
                </div>
                {filteredVoices.map((v) => (
                  <SelectItem key={v.voice_id} value={v.voice_id} className="text-xs py-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{v.name}</span>
                        <Badge variant="outline" className="text-[9px] h-3.5 px-1">
                          {v.language_id || v.language}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {v.gender} • {v.type}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Aspect ratio */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Format</label>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger className="max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map((r) => (
                  <SelectItem key={r.value} value={r.value} className="text-sm">
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)} className="cursor-pointer">
              ← Back
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!step3Valid}
              className="gradient-bg text-white shadow-md cursor-pointer"
            >
              Review & Generate →
            </Button>
          </div>
        </div>
      )}

      {/* ─── STEP 3: Generate ─── */}
      {step === 3 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div>
            <h2 className="text-base font-semibold mb-1">Review & Generate</h2>
            <p className="text-sm text-muted-foreground">
              Everything looks good? Hit generate and HeyGen will render your video.
            </p>
          </div>

          {/* Summary card */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Avatar */}
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Avatar</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {avatarMode === "twin"
                        ? (twinName || "My Digital Twin")
                        : avatarMode === "photo"
                        ? (photoForm.name || "AI Photo Avatar")
                        : (selectedAvatarName || selectedAvatarId)}
                    </p>
                    <Badge variant="outline" className="text-[9px] h-4">
                      {avatarMode === "twin" ? "Digital Twin" : avatarMode === "photo" ? "AI Photo Avatar" : "Library Avatar"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Background */}
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Background</p>
                {bgPreview && (
                  <div className="w-24 h-14 rounded-lg overflow-hidden border border-border">
                    <img src={bgPreview} alt="bg" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {/* Script */}
              <div className="space-y-1 sm:col-span-2">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Script</p>
                <p className="text-sm text-foreground line-clamp-3">{script}</p>
                <p className="text-xs text-muted-foreground">{script.length} characters</p>
              </div>

              {/* Format */}
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Format</p>
                <Badge variant="secondary">{aspectRatio}</Badge>
              </div>
            </div>
          </div>

          {/* Generate button */}
          {!videoId && !error && (
            <Button
              size="lg"
              className="w-full gradient-bg text-white shadow-lg text-base cursor-pointer"
              onClick={handleGenerate}
              disabled={!canGenerate}
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Starting generation...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Generate Real Estate Video
                </>
              )}
            </Button>
          )}

          {/* Processing state */}
          {videoId && videoStatus !== "completed" && videoStatus !== "failed" && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  <div>
                    <p className="text-sm font-medium">Rendering your video...</p>
                    <p className="text-xs text-muted-foreground">Usually takes 2–5 minutes. Hang tight!</p>
                  </div>
                </div>
                <Badge variant="secondary" className="animate-pulse">
                  {videoStatus || "processing"}
                </Badge>
              </div>

              {/* Background generation notice */}
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-start gap-2">
                <span className="text-base">🎬</span>
                <div>
                  <p className="text-xs font-semibold text-primary mb-0.5">Generation running in the background</p>
                  <p className="text-[11px] text-muted-foreground">
                    You can freely browse other features — the video will be ready when you return to this page. Your progress is saved automatically.
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Video ID:</span> {videoId}
                {polling && <span className="ml-3 text-[11px] animate-pulse">Checking every 5 seconds...</span>}
              </div>
            </div>
          )}

          {/* Completed */}
          {videoStatus === "completed" && videoUrl && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="rounded-xl overflow-hidden border border-border bg-black aspect-video shadow-xl">
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  poster={thumbnailUrl}
                  className="w-full h-full"
                />
              </div>
              <div className="flex gap-3">
                <a
                  href={videoUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button className="w-full gradient-bg text-white shadow-md cursor-pointer">
                    <Download className="w-4 h-4 mr-2" />
                    Download Video
                  </Button>
                </a>
                <Button variant="outline" onClick={resetVideo} className="cursor-pointer">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Make Another
                </Button>
              </div>
            </div>
          )}

          {/* Error */}
          {(error || videoStatus === "failed") && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-3">
              <p className="text-sm text-destructive font-medium">
                {error || "Video generation failed"}
              </p>
              <Button variant="outline" size="sm" onClick={resetVideo} className="cursor-pointer">
                <RotateCcw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}

          {!videoId && !error && (
            <Button variant="outline" onClick={() => setStep(2)} className="cursor-pointer">
              ← Back to Script
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function RealEstateVideoPage() {
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto py-8 px-4 flex items-center justify-center min-h-100">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Loading Real Estate Video Tool...</p>
        </div>
      </div>
    }>
      <RealEstateVideoContent />
    </Suspense>
  );
}
