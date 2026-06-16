"use client";

import { useState, useRef, useEffect, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  ShoppingBag,
  Upload,
  X,
  User,
  FileText,
  Sparkles,
  Loader2,
  CheckCircle2,
  ChevronRight,
  Info,
  Download,
  Wand2,
  ImagePlus,
  Mic,
  Play,
  RotateCcw,
  PenLine,
  Layers,
  Check,
} from "lucide-react";
import { AssetSelector } from "@/components/dashboard/asset-selector";

const MAX_SCRIPT = 200;

const PREBUILT_AVATARS = Array.from({ length: 8 }, (_, i) => ({
  id: `prebuilt-${i + 1}`,
  name: `Avatar ${i + 1}`,
  url: `/avatars/${i + 1}.png`,
}));

const LANGUAGES = [
  { id: "english", label: "English" },
  { id: "hindi", label: "Hindi" },
  { id: "hinglish", label: "Hinglish" },
];

const TONES = [
  { id: "friendly", label: "Friendly" },
  { id: "energetic", label: "Energetic" },
  { id: "professional", label: "Professional" },
  { id: "playful", label: "Playful" },
  { id: "luxury", label: "Luxury" },
];

async function compressImage(file, maxDimension = 1200, quality = 0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDimension) { height *= maxDimension / width; width = maxDimension; }
        } else {
          if (height > maxDimension) { width *= maxDimension / height; height = maxDimension; }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() })),
          "image/jpeg",
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Convert a data URL to a File
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

async function ensureFileFromImage(image, filename) {
  if (!image) return null;
  if (image instanceof File) return image;
  if (typeof image === "string") return dataUrlToFile(image, filename);
  return null;
}

// ─── Reusable image upload box ───────────────────────────────────────────────
function ImageUploadBox({ label, icon: Icon, image, onAdd, onRemove, hint, type = "all" }) {
  const inputRef = useRef(null);

  function handleFiles(files) {
    const valid = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (valid.length) onAdd(valid[0]);
    else toast.error("Please upload an image file (JPEG, PNG, WebP)");
  }

  async function handleAssetSelect(asset) {
    try {
      const response = await fetch(asset.url);
      const blob = await response.blob();
      onAdd(new File([blob], asset.name, { type: blob.type }));
    } catch (err) {
      toast.error("Failed to load asset", { description: err.message });
    }
  }

  if (image) {
    const previewUrl = typeof image === "string" ? image : URL.createObjectURL(image);
    return (
      <div className="relative rounded-xl overflow-hidden border border-border/50 shadow-md bg-card group">
        <img src={previewUrl} alt={label} className="w-full max-h-72 object-contain" />
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          <X className="w-3.5 h-3.5 text-white" />
        </button>
        <Badge className="absolute top-2 left-2 bg-primary/80 text-white border-0 text-[10px]">{label}</Badge>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary", "bg-primary/5"); }}
        onDragLeave={(e) => { e.currentTarget.classList.remove("border-primary", "bg-primary/5"); }}
        onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-primary", "bg-primary/5"); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-border/50 rounded-xl p-8 flex flex-col items-center gap-3 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer"
      >
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{hint || "Drag & drop or click to upload"}</p>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }} />
      </div>
      <AssetSelector type={type} onSelect={handleAssetSelect} />
    </div>
  );
}

// ─── Video Card component ────────────────────────────────────────────────────
function VideoCard({ status, video, index = 0, title }) {
  const isGenerating = status === "generating" || status === "pending";
  const isReady = status === "ready" && video?.videoUrl;

  return (
    <div className={`rounded-xl border transition-all ${ 
      isReady ? "border-primary/40 bg-card shadow-lg" : isGenerating ? "border-amber-500/40 bg-amber-500/5 animate-pulse" : "border-border/40 bg-muted/30 opacity-50"
    }`}>
      <div className="p-3 flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
          isReady ? "gradient-bg text-white" : isGenerating ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground"
        }`}>
          {isReady ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{title || (isReady ? "Video Ready" : isGenerating ? "Generating..." : "Waiting...")}</p>
          <p className="text-xs text-muted-foreground">{isReady ? "Ready to watch" : isGenerating ? "Creating your product video..." : "Waiting..."}</p>
        </div>
        {isGenerating && <Loader2 className="w-4 h-4 animate-spin text-amber-500 shrink-0" />}
      </div>
      {isReady && video?.videoUrl && (
        <div className="px-3 pb-3">
          <div className="rounded-xl overflow-hidden bg-black aspect-9/16 max-h-80 mx-auto relative">
            <video src={video.videoUrl} controls className="w-full h-full object-contain" autoPlay={false} />
          </div>
          <div className="flex justify-end mt-2">
            <a href={video.videoUrl} download={`product-video-${index + 1}.mp4`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
              <Download className="w-3.5 h-3.5" /> Download
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page content ───────────────────────────────────────────────────────
const STEPS = ["Product", "Avatar", "Composite", "Script", "Voice", "Generate"];
const STORAGE_KEY = "productToVideoState";

function ProductToVideoContent() {
  const searchParams = useSearchParams();
  const initialScript = searchParams.get("script");

  const [step, setStep] = useState(0);

  // Step 1: Product image
  const [productImage, setProductImage] = useState(null);

  // Step 2: Avatar (3 modes)
  const [avatarMode, setAvatarMode] = useState("prebuilt"); // "prebuilt" | "upload" | "generate"
  const [selectedAvatar, setSelectedAvatar] = useState(null); // { url, file? }
  const [uploadedAvatarFile, setUploadedAvatarFile] = useState(null);
  // Generate mode
  const [avatarPrompt, setAvatarPrompt] = useState("");
  const [avatarGender, setAvatarGender] = useState("");
  const [avatarAge, setAvatarAge] = useState("");
  const [avatarSkinTone, setAvatarSkinTone] = useState("");
  const [avatarEthnicity, setAvatarEthnicity] = useState("");
  const [avatarHair, setAvatarHair] = useState("");
  const [avatarBodyType, setAvatarBodyType] = useState("");
  const [avatarOutfit, setAvatarOutfit] = useState("");
  const [avatarDressStyle, setAvatarDressStyle] = useState("");
  const [avatarAccessories, setAvatarAccessories] = useState("");
  const [avatarLocation, setAvatarLocation] = useState("");
  const [avatarStyleNotes, setAvatarStyleNotes] = useState("");
  const [avatarVariantCount, setAvatarVariantCount] = useState(1);
  const [generatedAvatars, setGeneratedAvatars] = useState([]); // [{ url }]
  const [generatingAvatar, setGeneratingAvatar] = useState(false);

  // Step 3: Composite — MULTI-VARIANT
  const [compositeVariantCount, setCompositeVariantCount] = useState(2); 
  const [compositeDirections, setCompositeDirections] = useState([]); // [{ title, prompt }]
  const [composites, setComposites] = useState([]); // [{ url, file, title, direction }]
  const [generatingDirections, setGeneratingDirections] = useState(false);
  const [generatingComposites, setGeneratingComposites] = useState(false);
  const [compositeMode, setCompositeMode] = useState(null); // "single" | "all" | null (not chosen yet)
  const [selectedCompositeIndex, setSelectedCompositeIndex] = useState(null);

  // Step 4: Script — supports batch
  const [scripts, setScripts] = useState([]); // array of strings, one per active composite
  const [language, setLanguage] = useState("english");
  const [scriptTone, setScriptTone] = useState("friendly");
  const [allowEmotionTags, setAllowEmotionTags] = useState(true);
  const [generatingScript, setGeneratingScript] = useState(false);

  // Step 5: Voice prompt (shared across all variants since same person)
  const [voicePrompt, setVoicePrompt] = useState("");
  const [generatingVoice, setGeneratingVoice] = useState(false);

  // Step 6: Video generation — batch support
  const [generating, setGenerating] = useState(false);
  const [videoStatuses, setVideoStatuses] = useState([]); // ["pending"|"generating"|"ready"|"error"]  
  const [videoResults, setVideoResults] = useState([]); // [{ videoUrl }]
  const [done, setDone] = useState(false);
  const [isRestored, setIsRestored] = useState(false);

  useEffect(() => {
    if (initialScript) { setScripts([initialScript]); setStep(3); }
  }, [initialScript]);

  async function uploadAsset(file, type, name) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);
      if (name) fd.append("name", name);
      await fetch("/api/assets/upload", { method: "POST", body: fd });
    } catch (err) {
      console.error("Asset upload failed:", err);
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { setIsRestored(true); return; }
      const saved = JSON.parse(raw);

      if (saved.step !== undefined) setStep(saved.step);
      if (saved.productImage) setProductImage(saved.productImage);
      if (saved.avatarMode) setAvatarMode(saved.avatarMode);
      if (saved.uploadedAvatarFile) setUploadedAvatarFile(saved.uploadedAvatarFile);

      if (saved.selectedAvatar) {
        const restored = { ...saved.selectedAvatar };
        if (restored.fileDataUrl) {
          restored.url = restored.fileDataUrl;
          restored.file = dataUrlToFile(restored.fileDataUrl, "avatar.png");
        }
        setSelectedAvatar(restored);
      } else if (saved.uploadedAvatarFile && saved.avatarMode === "upload") {
        // Reconstruct selectedAvatar from uploadedAvatarFile data URL
        const file = dataUrlToFile(saved.uploadedAvatarFile, "avatar.png");
        setSelectedAvatar({ url: saved.uploadedAvatarFile, file, name: "Custom" });
      }

      if (saved.avatarPrompt) setAvatarPrompt(saved.avatarPrompt);
      if (saved.avatarGender) setAvatarGender(saved.avatarGender);
      if (saved.avatarAge) setAvatarAge(saved.avatarAge);
      if (saved.avatarSkinTone) setAvatarSkinTone(saved.avatarSkinTone);
      if (saved.avatarEthnicity) setAvatarEthnicity(saved.avatarEthnicity);
      if (saved.avatarHair) setAvatarHair(saved.avatarHair);
      if (saved.avatarBodyType) setAvatarBodyType(saved.avatarBodyType);
      if (saved.avatarOutfit) setAvatarOutfit(saved.avatarOutfit);
      if (saved.avatarDressStyle) setAvatarDressStyle(saved.avatarDressStyle);
      if (saved.avatarAccessories) setAvatarAccessories(saved.avatarAccessories);
      if (saved.avatarLocation) setAvatarLocation(saved.avatarLocation);
      if (saved.avatarStyleNotes) setAvatarStyleNotes(saved.avatarStyleNotes);
      if (saved.avatarVariantCount) setAvatarVariantCount(saved.avatarVariantCount);
      if (saved.generatedAvatars) setGeneratedAvatars(saved.generatedAvatars);

      if (saved.compositeVariantCount) setCompositeVariantCount(saved.compositeVariantCount);
      if (saved.compositeDirections) setCompositeDirections(saved.compositeDirections);
      if (saved.composites) {
        setComposites(
          saved.composites.map((c) => ({
            ...c,
            file: c.url?.startsWith("data:") ? dataUrlToFile(c.url, "composite.png") : null,
          }))
        );
      }
      if (saved.compositeMode) setCompositeMode(saved.compositeMode);
      if (saved.selectedCompositeIndex !== undefined) setSelectedCompositeIndex(saved.selectedCompositeIndex);

      if (saved.scripts) setScripts(saved.scripts);
      if (saved.language) setLanguage(saved.language);
      if (saved.scriptTone) setScriptTone(saved.scriptTone);
      if (typeof saved.allowEmotionTags === "boolean") setAllowEmotionTags(saved.allowEmotionTags);
      if (saved.voicePrompt) setVoicePrompt(saved.voicePrompt);

      if (saved.videoStatuses) setVideoStatuses(saved.videoStatuses);
      if (saved.videoResults) setVideoResults(saved.videoResults);
      if (saved.done) setDone(saved.done);
    } catch (err) {
      console.error("Failed to restore product-to-video state:", err);
    } finally {
      setIsRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!isRestored) return;
    let cancelled = false;

    async function saveState() {
      try {
        const productImageData = productImage instanceof File
          ? await fileToDataUrl(productImage)
          : productImage || null;

        const uploadedAvatarData = uploadedAvatarFile instanceof File
          ? await fileToDataUrl(uploadedAvatarFile)
          : uploadedAvatarFile || null;

        let selectedAvatarPayload = null;
        if (selectedAvatar) {
          let fileDataUrl = null;
          if (selectedAvatar.file instanceof File) {
            fileDataUrl = await fileToDataUrl(selectedAvatar.file);
          }
          selectedAvatarPayload = {
            url: selectedAvatar.url,
            name: selectedAvatar.name,
            fileDataUrl,
          };
        }

        const compositePayload = (composites || []).map((c) => ({
          url: c.url,
          title: c.title,
          direction: c.direction,
        }));

        const payload = {
          step,
          productImage: productImageData,
          avatarMode,
          uploadedAvatarFile: uploadedAvatarData,
          selectedAvatar: selectedAvatarPayload,
          avatarPrompt,
          avatarGender,
          avatarAge,
          avatarSkinTone,
          avatarEthnicity,
          avatarHair,
          avatarBodyType,
          avatarOutfit,
          avatarDressStyle,
          avatarAccessories,
          avatarLocation,
          avatarStyleNotes,
          avatarVariantCount,
          generatedAvatars,
          compositeVariantCount,
          compositeDirections,
          composites: compositePayload,
          compositeMode,
          selectedCompositeIndex,
          scripts,
          language,
          scriptTone,
          allowEmotionTags,
          voicePrompt,
          videoStatuses,
          videoResults,
          done,
        };

        if (!cancelled) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        }
      } catch (err) {
        console.error("Failed to persist product-to-video state:", err);
      }
    }

    saveState();
    return () => { cancelled = true; };
  }, [
    isRestored,
    step,
    productImage,
    avatarMode,
    uploadedAvatarFile,
    selectedAvatar,
    avatarPrompt,
    avatarGender,
    avatarAge,
    avatarSkinTone,
    avatarEthnicity,
    avatarHair,
    avatarBodyType,
    avatarOutfit,
    avatarDressStyle,
    avatarAccessories,
    avatarLocation,
    avatarStyleNotes,
    avatarVariantCount,
    generatedAvatars,
    compositeVariantCount,
    compositeDirections,
    composites,
    compositeMode,
    selectedCompositeIndex,
    scripts,
    language,
    scriptTone,
    allowEmotionTags,
    voicePrompt,
    videoStatuses,
    videoResults,
    done,
  ]);

  useEffect(() => {
    if (!isRestored || videoResults.length > 0) return;
    let active = true;

    async function loadRecentVideos() {
      try {
        const res = await fetch("/api/assets?type=clip");
        const data = await res.json();
        if (!res.ok) return;
        const items = (data.assets || [])
          .filter((a) => a?.metadata?.context === "product-video")
          .slice(0, 3)
          .map((a) => ({ videoUrl: a.url }));
        if (active && items.length) {
          setVideoResults(items);
          setVideoStatuses(items.map(() => "ready"));
          setDone(true);
        }
      } catch (err) {
        console.error("Failed to load recent product videos:", err);
      }
    }

    loadRecentVideos();
    return () => { active = false; };
  }, [isRestored, videoResults.length]);

  // Active composites = if single mode, just the selected one; if all mode, all of them
  const activeComposites = compositeMode === "single" && selectedCompositeIndex !== null
    ? [composites[selectedCompositeIndex]]
    : compositeMode === "all" ? composites : [];

  // Step validity
  const step1Valid = !!productImage;
  const step2Valid = !!selectedAvatar;
  const step3Valid = composites.length > 0 && compositeMode !== null && activeComposites.length > 0;
  const step4Valid = scripts.length === activeComposites.length && scripts.every((s) => s && s.trim().length >= 15);
  const step5Valid = voicePrompt.trim().length >= 20;

  // ─── Avatar generation ─────────────────────────────────────────────────────
  async function handleGenerateAvatars() {
    if (!avatarPrompt.trim() || avatarPrompt.trim().length < 10) {
      toast.error("Please describe the avatar in at least 10 characters");
      return;
    }
    setGeneratingAvatar(true);
    setGeneratedAvatars([]);
    try {
      const customization = [
        avatarGender && `Gender: ${avatarGender}`,
        avatarAge && `Age range: ${avatarAge}`,
        avatarEthnicity && `Ethnicity/nationality: ${avatarEthnicity}`,
        avatarSkinTone && `Skin tone: ${avatarSkinTone}`,
        avatarHair && `Hair: ${avatarHair}`,
        avatarBodyType && `Body type: ${avatarBodyType}`,
        avatarOutfit && `Outfit: ${avatarOutfit}`,
        avatarDressStyle && `Dressing style: ${avatarDressStyle}`,
        avatarAccessories && `Accessories: ${avatarAccessories}`,
        avatarLocation && `Setting/background: ${avatarLocation}`,
        avatarStyleNotes && `Style notes: ${avatarStyleNotes}`,
      ].filter(Boolean).join(". ");

      const finalPrompt = customization
        ? `${avatarPrompt.trim()}. ${customization}`
        : avatarPrompt.trim();

      const res = await fetch("/api/product-video/generate-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: finalPrompt, variants: avatarVariantCount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate avatars");
      setGeneratedAvatars(data.images || []);
      toast.success(`Generated ${data.images.length} avatar variant(s)!`);
    } catch (err) {
      toast.error("Avatar generation failed", { description: err.message });
    } finally {
      setGeneratingAvatar(false);
    }
  }

  // ─── Get composite directions from Gemini ──────────────────────────────────
  async function handleGetDirections() {
    if (!productImage || !selectedAvatar) return;
    setGeneratingDirections(true);
    setCompositeDirections([]);
    setComposites([]);
    setCompositeMode(null);
    setSelectedCompositeIndex(null);
    try {
      let avatarFile;
      if (selectedAvatar.file) {
        avatarFile = await compressImage(selectedAvatar.file);
      } else if (selectedAvatar.url?.startsWith("data:")) {
        avatarFile = await compressImage(dataUrlToFile(selectedAvatar.url, "avatar.png"));
      } else {
        const res = await fetch(selectedAvatar.url);
        const blob = await res.blob();
        avatarFile = await compressImage(new File([blob], "avatar.png", { type: blob.type }));
      }
      const productFile = await ensureFileFromImage(productImage, "product.png");
      const compressedProduct = await compressImage(productFile);

      const fd = new FormData();
      fd.append("avatarImage", avatarFile);
      fd.append("productImage", compressedProduct);
      fd.append("variantCount", compositeVariantCount.toString());

      const res = await fetch("/api/product-video/composite-directions", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get directions");

      setCompositeDirections(data.directions || []);
      toast.success(`${data.directions.length} creative direction(s) ready!`);

      // Auto-generate composites right after
      await generateCompositesFromDirections(data.directions, avatarFile, compressedProduct);
    } catch (err) {
      toast.error("Direction generation failed", { description: err.message });
    } finally {
      setGeneratingDirections(false);
    }
  }

  // ─── Generate composites from directions ───────────────────────────────────
  async function generateCompositesFromDirections(directions, avatarFile, productFile) {
    setGeneratingComposites(true);
    setComposites([]);
    try {
      toast.info(`Generating ${directions.length} composite image(s)...`);

      const results = [];
      for (let i = 0; i < directions.length; i++) {
        const dir = directions[i];
        toast.info(`Creating variant ${i + 1}/${directions.length}: ${dir.title}`, { id: "composite-progress" });

        const fd = new FormData();
        fd.append("avatarImage", avatarFile);
        fd.append("productImage", productFile);
        fd.append("direction", dir.prompt);

        const res = await fetch("/api/product-video/composite", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Composite ${i + 1} failed`);

        results.push({
          url: data.compositeUrl,
          file: dataUrlToFile(data.compositeUrl, `composite-${i}.png`),
          title: dir.title,
          direction: dir.prompt,
        });
      }

      setComposites(results);
      toast.success(`${results.length} composite(s) generated!`, { id: "composite-progress" });
    } catch (err) {
      toast.error("Composite generation failed", { description: err.message });
    } finally {
      setGeneratingComposites(false);
    }
  }

  // ─── Script generation ─────────────────────────────────────────────────────
  async function handleGenerateScripts() {
    if (activeComposites.length === 0 || !productImage) return;
    setGeneratingScript(true);
    try {
      const productFile = await ensureFileFromImage(productImage, "product.png");
      const compressedProduct = await compressImage(productFile);

      if (activeComposites.length === 1) {
        // Single mode
        const fd = new FormData();
        fd.append("compositeImage", activeComposites[0].file);
        fd.append("productImage", compressedProduct);
        fd.append("language", language);
        fd.append("tone", scriptTone);
        fd.append("allowEmotionTags", allowEmotionTags ? "true" : "false");

        const res = await fetch("/api/product-video/generate-script", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Script generation failed");
        setScripts([data.script]);
        toast.success("Script generated!");
      } else {
        // Batch mode
        const fd = new FormData();
        fd.append("productImage", compressedProduct);
        fd.append("compositeCount", activeComposites.length.toString());
        fd.append("language", language);
        fd.append("tone", scriptTone);
        fd.append("allowEmotionTags", allowEmotionTags ? "true" : "false");
        activeComposites.forEach((c, i) => fd.append(`compositeImage_${i}`, c.file));

        const res = await fetch("/api/product-video/generate-script", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Script generation failed");
        setScripts(data.scripts || []);
        toast.success(`${data.scripts?.length || 0} script(s) generated!`);
      }
    } catch (err) {
      toast.error("Script generation failed", { description: err.message });
    } finally {
      setGeneratingScript(false);
    }
  }

  // Generate a single script for a specific index
  async function handleGenerateSingleScript(index) {
    if (!activeComposites[index] || !productImage) return;
    setGeneratingScript(true);
    try {
      const fd = new FormData();
      fd.append("compositeImage", activeComposites[index].file);
      const productFile = await ensureFileFromImage(productImage, "product.png");
      fd.append("productImage", await compressImage(productFile));
      fd.append("language", language);
      fd.append("tone", scriptTone);
      fd.append("allowEmotionTags", allowEmotionTags ? "true" : "false");

      const res = await fetch("/api/product-video/generate-script", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Script generation failed");

      const newScripts = [...scripts];
      newScripts[index] = data.script;
      setScripts(newScripts);
      toast.success(`Script ${index + 1} generated!`);
    } catch (err) {
      toast.error("Script generation failed", { description: err.message });
    } finally {
      setGeneratingScript(false);
    }
  }

  // ─── Voice prompt generation ───────────────────────────────────────────────
  async function handleGenerateVoicePrompt() {
    if (activeComposites.length === 0 || !scripts[0]?.trim()) return;
    setGeneratingVoice(true);
    try {
      const fd = new FormData();
      fd.append("compositeImage", activeComposites[0].file); // Use first composite for voice analysis
      fd.append("script", scripts[0].trim());
      fd.append("allowEmotionTags", allowEmotionTags ? "true" : "false");

      const res = await fetch("/api/product-video/generate-voice-prompt", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Voice prompt generation failed");
      setVoicePrompt(data.voicePrompt);
      toast.success("Voice prompt generated!");
    } catch (err) {
      toast.error("Voice prompt failed", { description: err.message });
    } finally {
      setGeneratingVoice(false);
    }
  }

  // ─── Video generation (batch) ──────────────────────────────────────────────
  async function handleGenerateVideos() {
    if (activeComposites.length === 0 || !scripts.length || !voicePrompt.trim()) return;
    setGenerating(true);
    setVideoStatuses(activeComposites.map(() => "pending"));
    setVideoResults(activeComposites.map(() => null));
    setDone(false);

    for (let i = 0; i < activeComposites.length; i++) {
      try {
        setVideoStatuses((prev) => { const n = [...prev]; n[i] = "generating"; return n; });
        toast.info(`Generating video ${i + 1} of ${activeComposites.length}...`, { id: `video-${i}` });

        const fd = new FormData();
        fd.append("compositeImage", activeComposites[i].file);
        fd.append("script", scripts[i].trim());
        fd.append("voicePrompt", voicePrompt.trim());

        const response = await fetch("/api/product-video/generate", { method: "POST", body: fd });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Generation failed");
        }
        if (!response.body) throw new Error("No response stream");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done: streamDone } = await reader.read();
          if (streamDone) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "progress") {
                toast.info(event.message, { id: `video-${i}` });
              }
              if (event.type === "video_ready") {
                setVideoStatuses((prev) => { const n = [...prev]; n[i] = "ready"; return n; });
                setVideoResults((prev) => { const n = [...prev]; n[i] = { videoUrl: event.videoUrl }; return n; });
                toast.success(`🎬 Video ${i + 1} ready!`, { id: `video-${i}` });
              }
              if (event.type === "error") {
                toast.error(`Video ${i + 1} error`, { description: event.message });
                setVideoStatuses((prev) => { const n = [...prev]; n[i] = "error"; return n; });
              }
            } catch {}
          }
        }
      } catch (err) {
        console.error(err);
        toast.error(`Video ${i + 1} failed`, { description: err.message });
        setVideoStatuses((prev) => { const n = [...prev]; n[i] = "error"; return n; });
      }
    }

    setDone(true);
    setGenerating(false);
    toast.success("✅ All videos generated!");
  }

  function reset() {
    setProductImage(null);
    setSelectedAvatar(null);
    setUploadedAvatarFile(null);
    setGeneratedAvatars([]);
    setCompositeDirections([]);
    setComposites([]);
    setCompositeMode(null);
    setSelectedCompositeIndex(null);
    setScripts([]);
    setVoicePrompt("");
    setVideoStatuses([]);
    setVideoResults([]);
    setDone(false);
    setGenerating(false);
    setStep(0);
  }

  const showResults = videoStatuses.length > 0;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center shadow-md">
          <ShoppingBag className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Product Video</h1>
          <p className="text-sm text-muted-foreground">
            Create cinematic UGC product showcases — powered by Gemini & Veo 3.1
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex gap-2.5 mb-6">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Upload a <strong className="text-foreground">product photo</strong>, choose an <strong className="text-foreground">AI avatar</strong>, and we'll generate <strong className="text-foreground">multiple variant composites</strong> with different poses. Pick one or use all — each gets its own script and video.
        </p>
      </div>

      {/* Step progress */}
      {!showResults && (
        <div className="flex items-center gap-0.5 mb-7 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-0.5 flex-1 min-w-0">
              <button
                onClick={() => { if (i < step) setStep(i); }}
                className={`flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded-full transition-all whitespace-nowrap ${
                  step === i
                    ? "gradient-bg text-white shadow-md"
                    : i < step
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground bg-muted/50"
                }`}
              >
                {i < step ? <CheckCircle2 className="w-3 h-3" /> : (
                  <span className="w-4 h-4 rounded-full border text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                )}
                <span className="hidden sm:inline">{s}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`h-px flex-1 min-w-2 transition-colors ${i < step ? "bg-primary/40" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── STEP 0: Product Image ── */}
      {!showResults && step === 0 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <ImageUploadBox
            label="Product Photo"
            icon={ShoppingBag}
            image={productImage}
            onAdd={async (file) => {
              setProductImage(file);
              await uploadAsset(file, "products", "Product Photo");
            }}
            onRemove={() => setProductImage(null)}
            type="products"
            hint="Upload a clear photo of just the product (no faces). This will be the product shown in the video."
          />
          <div className="flex justify-end">
            <Button onClick={() => setStep(1)} disabled={!step1Valid} className="gradient-bg text-white shadow-md cursor-pointer">
              Next: Avatar <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 1: Avatar Selection ── */}
      {!showResults && step === 1 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Mode tabs */}
          <div className="flex gap-2">
            {[
              { id: "prebuilt", label: "Pre-built", icon: User },
              { id: "upload", label: "Upload", icon: Upload },
              { id: "generate", label: "AI Generate", icon: Sparkles },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => { setAvatarMode(m.id); setSelectedAvatar(null); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  avatarMode === m.id
                    ? "gradient-bg text-white shadow-md"
                    : "border border-border hover:border-primary/40 text-muted-foreground"
                }`}
              >
                <m.icon className="w-3.5 h-3.5" />
                {m.label}
              </button>
            ))}
          </div>

          {/* Pre-built avatars */}
          {avatarMode === "prebuilt" && (
            <div className="grid grid-cols-4 gap-3">
              {PREBUILT_AVATARS.map((av) => (
                <button
                  key={av.id}
                  onClick={() => setSelectedAvatar({ url: av.url, file: null, name: av.name })}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer group ${
                    selectedAvatar?.url === av.url
                      ? "border-primary ring-2 ring-primary/30 scale-105"
                      : "border-border/50 hover:border-primary/50"
                  }`}
                >
                  <img src={av.url} alt={av.name} className="w-full h-full object-cover" />
                  {selectedAvatar?.url === av.url && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-white text-center truncate">{av.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {avatarMode === "upload" && (
            <div className="space-y-3">
              <ImageUploadBox
                label="Your Photo"
                icon={User}
                image={uploadedAvatarFile}
                onAdd={async (file) => {
                  setUploadedAvatarFile(file);
                  // Use a data URL so it persists after navigation (blob URLs expire)
                  const dataUrl = await fileToDataUrl(file);
                  setSelectedAvatar({ url: dataUrl, file, name: "Custom" });
                  uploadAsset(file, "avatars", "Custom Avatar");
                }}
                onRemove={() => { setUploadedAvatarFile(null); setSelectedAvatar(null); }}
                type="avatars"
                hint="Upload a clear photo of yourself or anyone you want as the presenter."
              />
              {selectedAvatar && avatarMode === "upload" && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs text-primary font-medium">Avatar selected and ready to use</span>
                </div>
              )}
            </div>
          )}

          {/* Generate avatar */}
          {avatarMode === "generate" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Describe the avatar</Label>
                <Textarea
                  value={avatarPrompt}
                  onChange={(e) => setAvatarPrompt(e.target.value)}
                  placeholder="e.g., A young Indian woman in her late 20s with short wavy hair, wearing a simple white cotton t-shirt, warm smile..."
                  className="min-h-20 resize-none text-sm"
                  maxLength={500}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Gender</Label>
                  <Input value={avatarGender} onChange={(e) => setAvatarGender(e.target.value)} placeholder="e.g., Female" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Age range</Label>
                  <Input value={avatarAge} onChange={(e) => setAvatarAge(e.target.value)} placeholder="e.g., Late 20s" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ethnicity / Nationality</Label>
                  <Input value={avatarEthnicity} onChange={(e) => setAvatarEthnicity(e.target.value)} placeholder="e.g., South Indian, Bengali, North Indian" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Skin tone</Label>
                  <Input value={avatarSkinTone} onChange={(e) => setAvatarSkinTone(e.target.value)} placeholder="e.g., Fair, Wheatish, Dark" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hair (color &amp; style)</Label>
                  <Input value={avatarHair} onChange={(e) => setAvatarHair(e.target.value)} placeholder="e.g., Long black wavy hair" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Body type</Label>
                  <Input value={avatarBodyType} onChange={(e) => setAvatarBodyType(e.target.value)} placeholder="e.g., Slim, Athletic, Curvy" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Outfit</Label>
                  <Input value={avatarOutfit} onChange={(e) => setAvatarOutfit(e.target.value)} placeholder="e.g., White cotton tee and jeans" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Dressing style</Label>
                  <Input value={avatarDressStyle} onChange={(e) => setAvatarDressStyle(e.target.value)} placeholder="e.g., Casual, Formal, Ethnic, Street" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Accessories</Label>
                  <Input value={avatarAccessories} onChange={(e) => setAvatarAccessories(e.target.value)} placeholder="e.g., Gold earrings, glasses, watch" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Place / background</Label>
                  <Input value={avatarLocation} onChange={(e) => setAvatarLocation(e.target.value)} placeholder="e.g., Cozy living room" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Extra style notes (makeup, expression, mood)</Label>
                  <Input value={avatarStyleNotes} onChange={(e) => setAvatarStyleNotes(e.target.value)} placeholder="e.g., Minimal makeup, warm smile, confident" />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Variants</Label>
                  <div className="flex gap-1.5">
                    {[1, 2, 3].map((n) => (
                      <button
                        key={n}
                        onClick={() => setAvatarVariantCount(n)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          avatarVariantCount === n
                            ? "gradient-bg text-white"
                            : "border border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={handleGenerateAvatars}
                  disabled={generatingAvatar || avatarPrompt.trim().length < 10}
                  className="gradient-bg text-white shadow-md cursor-pointer mt-4"
                  size="sm"
                >
                  {generatingAvatar ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate</>
                  )}
                </Button>
              </div>

              {/* Generated results */}
              {generatedAvatars.length > 0 && (
                <div className="grid grid-cols-3 gap-3 pt-2">
                  {generatedAvatars.map((av, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        const file = dataUrlToFile(av.url, `avatar-generated-${i}.png`);
                        setSelectedAvatar({ url: av.url, file, name: `Generated ${i + 1}` });
                      }}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer animate-in zoom-in-50 duration-300 ${
                        selectedAvatar?.url === av.url
                          ? "border-primary ring-2 ring-primary/30 scale-105"
                          : "border-border/50 hover:border-primary/50"
                      }`}
                    >
                      <img src={av.url} alt={`Variant ${i + 1}`} className="w-full h-full object-cover" />
                      {selectedAvatar?.url === av.url && (
                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <Badge className="absolute top-1 left-1 bg-primary/80 text-white text-[8px] px-1 py-0 border-0">V{i + 1}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedAvatar && (
            <div className="flex items-center gap-2 pt-1">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="text-sm">Selected: <strong>{selectedAvatar.name}</strong></span>
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)} className="cursor-pointer">Back</Button>
            <Button onClick={() => { setStep(2); handleGetDirections(); }} disabled={!step2Valid} className="gradient-bg text-white shadow-md cursor-pointer">
              Next: Composites <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Multi-Variant Composites ── */}
      {!showResults && step === 2 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Composite Variants</span>
          </div>
          <p className="text-xs text-muted-foreground">
            AI creates multiple takes of your avatar with the product — different poses, angles, and actions. Pick one or use all for batch video generation.
          </p>

          {/* Variant count selector */}
          <div className="flex items-center gap-3">
            <Label className="text-xs text-muted-foreground">Number of variants:</Label>
            <div className="flex gap-1.5">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setCompositeVariantCount(n)}
                  disabled={composites.length > 0}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    compositeVariantCount === n
                      ? "gradient-bg text-white"
                      : "border border-border text-muted-foreground hover:border-primary/40"
                  } ${composites.length > 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Loading - Directions */}
          {generatingDirections && (
            <div className="rounded-xl border-2 border-dashed border-primary/30 p-6 flex flex-col items-center gap-3 bg-primary/5">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">AI is planning creative directions...</p>
            </div>
          )}

          {/* Loading - Composites */}
          {generatingComposites && (
            <div className="rounded-xl border-2 border-dashed border-amber-500/30 p-6 flex flex-col items-center gap-3 bg-amber-500/5">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-sm text-muted-foreground">Generating composite images...</p>
              <p className="text-xs text-muted-foreground">Each variant takes ~15-30 seconds</p>
            </div>
          )}

          {/* Show generated composites */}
          {composites.length > 0 && !generatingComposites && (
            <>
              <div className={`grid gap-4 ${composites.length === 1 ? "grid-cols-1 max-w-xs mx-auto" : composites.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                {composites.map((comp, i) => (
                  <div
                    key={i}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer group ${
                      compositeMode === "single" && selectedCompositeIndex === i
                        ? "border-primary ring-2 ring-primary/30 scale-[1.02]"
                        : compositeMode === "all"
                        ? "border-green-500/50 ring-1 ring-green-500/20"
                        : "border-border/50 hover:border-primary/50"
                    }`}
                    onClick={() => {
                      if (compositeMode === null || compositeMode === "single") {
                        setCompositeMode("single");
                        setSelectedCompositeIndex(i);
                        setScripts([]);
                      }
                    }}
                  >
                    <img src={comp.url} alt={comp.title} className="w-full rounded-xl" />
                    <Badge className="absolute top-2 left-2 bg-black/70 text-white border-0 text-[10px] backdrop-blur-sm">
                      {comp.title}
                    </Badge>
                    {compositeMode === "single" && selectedCompositeIndex === i && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    {compositeMode === "all" && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              {composites.length > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <Button
                    variant={compositeMode === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setCompositeMode("all"); setSelectedCompositeIndex(null); setScripts([]); }}
                    className={`cursor-pointer text-xs ${compositeMode === "all" ? "gradient-bg text-white" : ""}`}
                  >
                    <Layers className="w-3 h-3 mr-1" /> Use All ({composites.length} videos)
                  </Button>
                  <span className="text-xs text-muted-foreground">or click one to use it</span>
                </div>
              )}

              {composites.length === 1 && compositeMode === null && (
                <div className="text-center">
                  <Button
                    size="sm"
                    onClick={() => { setCompositeMode("single"); setSelectedCompositeIndex(0); }}
                    className="gradient-bg text-white cursor-pointer text-xs"
                  >
                    <Check className="w-3 h-3 mr-1" /> Use This Composite
                  </Button>
                </div>
              )}

              {/* Regenerate */}
              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={handleGetDirections} disabled={generatingDirections || generatingComposites} className="cursor-pointer text-xs">
                  <RotateCcw className="w-3 h-3 mr-1" /> Regenerate All
                </Button>
              </div>
            </>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)} className="cursor-pointer">Back</Button>
            <Button onClick={() => setStep(3)} disabled={!step3Valid} className="gradient-bg text-white shadow-md cursor-pointer">
              Next: Script <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Script ── */}
      {!showResults && step === 3 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">
              {activeComposites.length > 1 ? `Scripts (${activeComposites.length} videos)` : "Script"}
            </span>
          </div>

          {/* Language selector */}
          <div className="flex gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.id}
                onClick={() => setLanguage(l.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  language === l.id ? "gradient-bg text-white" : "border border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Tone selector */}
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
            <Label className="text-xs text-muted-foreground">Allow emotion tags like {{happy}} or {{sad}}</Label>
          </div>

          {/* Batch "Fill All" button */}
          {activeComposites.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateScripts}
              disabled={generatingScript}
              className="cursor-pointer text-xs w-full"
            >
              {generatingScript ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
              ✨ AI Write All {activeComposites.length} Scripts
            </Button>
          )}

          {/* Script textareas — one per active composite */}
          {activeComposites.map((comp, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-border/50 p-3 bg-card/50">
              {activeComposites.length > 1 && (
                <div className="flex items-center gap-2 mb-1">
                  <img src={comp.url} alt={comp.title} className="w-10 h-14 rounded-lg object-cover border border-border" />
                  <div>
                    <p className="text-xs font-semibold">{comp.title}</p>
                    <p className="text-[10px] text-muted-foreground">Video {i + 1}</p>
                  </div>
                  <span className={`text-xs ml-auto font-mono ${(scripts[i]?.length || 0) > MAX_SCRIPT ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                    {scripts[i]?.length || 0}/{MAX_SCRIPT}
                  </span>
                </div>
              )}
              {activeComposites.length === 1 && (
                <div className="flex justify-end">
                  <span className={`text-xs font-mono ${(scripts[0]?.length || 0) > MAX_SCRIPT ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                    {scripts[0]?.length || 0}/{MAX_SCRIPT}
                  </span>
                </div>
              )}
              <Textarea
                value={scripts[i] || ""}
                onChange={(e) => {
                  const newScripts = [...scripts];
                  newScripts[i] = e.target.value.slice(0, MAX_SCRIPT);
                  setScripts(newScripts);
                }}
                placeholder="Write what the presenter should say about the product (8 seconds)..."
                className="min-h-20 resize-none text-sm"
                maxLength={MAX_SCRIPT}
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => activeComposites.length === 1 ? handleGenerateScripts() : handleGenerateSingleScript(i)}
                  disabled={generatingScript}
                  className="cursor-pointer text-xs"
                >
                  {generatingScript ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <PenLine className="w-3 h-3 mr-1" />}
                  ✨ AI Write
                </Button>
                <p className="text-xs text-muted-foreground">Max {MAX_SCRIPT} chars • ~8 seconds</p>
              </div>
            </div>
          ))}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)} className="cursor-pointer">Back</Button>
            <Button onClick={() => { setStep(4); handleGenerateVoicePrompt(); }} disabled={!step4Valid} className="gradient-bg text-white shadow-md cursor-pointer">
              Next: Voice <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Voice Prompt ── */}
      {!showResults && step === 4 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Voice Description</span>
          </div>
          <p className="text-xs text-muted-foreground">
            AI has analyzed the avatar and script to create a realistic voice description. This voice will be used for {activeComposites.length > 1 ? `all ${activeComposites.length} videos` : "the video"}.
          </p>

          {generatingVoice ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing avatar & script for voice...</p>
            </div>
          ) : (
            <Textarea
              value={voicePrompt}
              onChange={(e) => setVoicePrompt(e.target.value)}
              placeholder="AI will generate a detailed voice description here..."
              className="min-h-30 resize-none text-sm"
            />
          )}

          {!generatingVoice && voicePrompt && (
            <Button variant="outline" size="sm" onClick={handleGenerateVoicePrompt} className="cursor-pointer text-xs">
              <RotateCcw className="w-3 h-3 mr-1" /> Regenerate Voice
            </Button>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(3)} className="cursor-pointer">Back</Button>
            <Button onClick={() => setStep(5)} disabled={!step5Valid} className="gradient-bg text-white shadow-md cursor-pointer">
              Next: Generate {activeComposites.length > 1 ? `${activeComposites.length} Videos` : "Video"} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 5: Generate ── */}
      {!showResults && step === 5 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2 mb-2">
            <Play className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Ready to Generate {activeComposites.length > 1 ? `${activeComposites.length} Videos` : ""}</span>
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-4">
            {/* Composite previews */}
            <div className={`grid gap-3 ${activeComposites.length === 1 ? "grid-cols-3" : activeComposites.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
              {activeComposites.map((comp, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{comp.title || `Video ${i + 1}`}</p>
                  <img src={comp.url} alt={comp.title} className="w-full rounded-lg border border-border" />
                  <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">"{scripts[i]}"</p>
                </div>
              ))}
            </div>

            <div className="pt-2 space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Voice</p>
              <p className="text-xs text-foreground leading-relaxed line-clamp-2">{voicePrompt}</p>
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(4)} className="cursor-pointer">Back</Button>
            <Button
              onClick={handleGenerateVideos}
              disabled={generating}
              className="gradient-bg text-white shadow-md cursor-pointer px-8"
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Generate {activeComposites.length > 1 ? `${activeComposites.length} Videos` : "Video"}</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── RESULTS ── */}
      {showResults && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">
              {done ? `✅ ${videoResults.filter(Boolean).length} video(s) ready` : "Generating your product video(s)..."}
            </h2>
            {done && (
              <Button variant="outline" size="sm" onClick={reset} className="cursor-pointer text-xs">
                Start over
              </Button>
            )}
          </div>

          {/* Background generation notice — shown while still rendering */}
          {!done && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-start gap-2">
              <span className="text-base">🎬</span>
              <div>
                <p className="text-xs font-semibold text-primary mb-0.5">Generation running in the background</p>
                <p className="text-[11px] text-muted-foreground">
                  You can freely browse other features — your video(s) will be ready when you return to this page. Your progress is saved automatically.
                </p>
              </div>
            </div>
          )}

          {activeComposites.map((comp, i) => (
            <VideoCard
              key={i}
              status={videoStatuses[i]}
              video={videoResults[i]}
              index={i}
              title={comp.title || `Video ${i + 1}`}
            />
          ))}

          {done && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
              <p className="text-sm font-medium">🎬 {videoResults.filter(Boolean).length} video(s) generated successfully!</p>
              <p className="text-xs text-muted-foreground mt-1">
                Download your cinematic 8-second product showcase(s) above.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProductToVideoPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-100"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <ProductToVideoContent />
    </Suspense>
  );
}
