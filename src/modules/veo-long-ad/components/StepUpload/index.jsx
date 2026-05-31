"use client";

import { useState, useCallback } from "react";
import {
  Upload,
  X,
  CheckCircle2,
  ImagePlus,
  User2,
  ChevronRight,
  Loader2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAvatars } from "@/modules/ai-walkthrough/hooks/useAvatars";

/**
 * StepUpload — Step 1 for the Long-Form Veo Ad pipeline.
 *
 * Reuses the existing avatar logic (same hook, same prebuilt / upload flow)
 * but shows a simplified, focused 2-column layout:
 *   LEFT:  Location images (up to 8, mandatory)
 *   RIGHT: Avatar / presenter (same avatar modes, mandatory)
 */
export function StepUpload({ locationImages, setLocationImages, avatarHook, onNext, isValid }) {
  const [draggingLocation, setDraggingLocation] = useState(false);

  // ── Location images ────────────────────────────────────────────────────────
  const handleLocationFiles = useCallback(
    (files) => {
      const validFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (validFiles.length === 0) return toast.error("Please upload image files.");
      if (locationImages.length + validFiles.length > 8) {
        return toast.error("Maximum 8 location images allowed.");
      }
      const withPreview = validFiles.map((f) => ({
        file: f,
        url: URL.createObjectURL(f),
        name: f.name,
      }));
      setLocationImages((prev) => [...prev, ...withPreview]);
    },
    [locationImages, setLocationImages]
  );

  const removeLocation = (idx) => {
    setLocationImages((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx]?.url);
      next.splice(idx, 1);
      return next;
    });
  };

  const onDropLocation = (e) => {
    e.preventDefault();
    setDraggingLocation(false);
    handleLocationFiles(e.dataTransfer.files);
  };

  // ── Avatar section ────────────────────────────────────────────────────────
  const { reAvatars, reAvatarsLoading, selectedAvatars, selectCollection, isCollectionSelected,
    uploadedAvatarFiles, handleUploadFile, toggleUploadedAvatar, removeUploadedAvatar } = avatarHook;

  const selectedCollectionAvatarData = reAvatars.find((col) =>
    isCollectionSelected(col.id)
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold font-heading tracking-tight">Upload Property & Presenter</h2>
        <p className="text-sm text-muted-foreground">
          Add exterior property photos and select a presenter for your long-form ad.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* ── Left: Location Images ───────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <ImagePlus className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Property Photos</h3>
              <p className="text-[11px] text-muted-foreground">Exterior only · Up to 8 images</p>
            </div>
            <span className="ml-auto text-xs font-medium text-muted-foreground">
              {locationImages.length}/8
            </span>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDraggingLocation(true); }}
            onDragLeave={() => setDraggingLocation(false)}
            onDrop={onDropLocation}
            className={`relative border-2 border-dashed rounded-2xl transition-all ${
              draggingLocation
                ? "border-primary bg-primary/5 scale-[1.01]"
                : locationImages.length === 0
                ? "border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/30"
                : "border-border/40 bg-muted/10"
            }`}
          >
            {locationImages.length === 0 ? (
              <label className="flex flex-col items-center gap-3 py-10 cursor-pointer">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Drop photos here or click to upload</p>
                  <p className="text-[11px] text-muted-foreground mt-1">PNG, JPG, WEBP up to 10MB each</p>
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleLocationFiles(e.target.files)}
                />
              </label>
            ) : (
              <div className="p-3 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {locationImages.map((img, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-border/30">
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeLocation(idx)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {locationImages.length < 8 && (
                    <label className="aspect-square rounded-xl border-2 border-dashed border-border/50 flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
                      <ImagePlus className="w-5 h-5 text-muted-foreground" />
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleLocationFiles(e.target.files)}
                      />
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>

          {locationImages.length > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{locationImages.length} photo{locationImages.length !== 1 ? "s" : ""} added</span>
            </div>
          )}

          <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 dark:border-amber-800/30 dark:bg-amber-900/10 p-3 flex gap-2">
            <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
              Upload <strong>exterior photos only</strong> (gate, facade, balcony, drone). Interior shots will be rejected by Veo. The more exterior angles you provide, the better the video.
            </p>
          </div>
        </div>

        {/* ── Right: Avatar / Presenter ─────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <User2 className="w-4 h-4 text-violet-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Presenter / Avatar</h3>
              <p className="text-[11px] text-muted-foreground">Choose from RE Agents or upload your own</p>
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-2">
            {["prebuilt", "upload"].map((mode) => (
              <button
                key={mode}
                onClick={() => avatarHook.setAvatarMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  avatarHook.avatarMode === mode
                    ? "bg-primary text-white shadow"
                    : "border border-border/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode === "prebuilt" ? "RE Agents" : "Upload Presenter"}
              </button>
            ))}
          </div>

          {/* Prebuilt avatars (collection grid) */}
          {avatarHook.avatarMode === "prebuilt" && (
            <div className="space-y-2">
              {reAvatarsLoading ? (
                <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading RE Agents...
                </div>
              ) : reAvatars.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  No RE Agents found. Upload your own presenter.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                  {reAvatars.map((col) => {
                    const selected = isCollectionSelected(col.id);
                    const thumb = col.coverImage || col.images?.[0]?.url;
                    return (
                      <button
                        key={col.id}
                        onClick={() => selectCollection(col)}
                        className={`relative rounded-2xl overflow-hidden border-2 transition-all text-left ${
                          selected
                            ? "border-primary ring-2 ring-primary/30 scale-[1.02]"
                            : "border-border/40 hover:border-primary/40"
                        }`}
                      >
                        {thumb ? (
                          <img src={thumb} alt={col.name} className="w-full h-64 object-cover" />
                        ) : (
                          <div className="w-full h-28 bg-muted/30 flex items-center justify-center">
                            <User2 className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        {selected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                        <p className="absolute bottom-2 left-2 right-2 text-[11px] text-white font-medium truncate">
                          {col.name}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Upload avatars */}
          {avatarHook.avatarMode === "upload" && (
            <div className="space-y-2">
              <label className="block">
                <div className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  uploadedAvatarFiles.length > 0
                    ? "border-border/30"
                    : "border-border hover:border-primary/50 bg-muted/10"
                }`}>
                  <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">Upload Presenter Photo</p>
                  <p className="text-[11px] text-muted-foreground">Clear face photo, front-facing</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) avatarHook.handleUploadFile(e.target.files[0]);
                  }}
                />
              </label>

              {uploadedAvatarFiles.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {uploadedAvatarFiles.map((f) => {
                    const isSelected = selectedAvatars.some(
                      (a) => a.key === f.id || a.url === f.url
                    );
                    return (
                      <div key={f.id} className="relative group">
                        <button
                          onClick={() => avatarHook.toggleUploadedAvatar(f)}
                          className={`relative w-full aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                            isSelected ? "border-primary ring-2 ring-primary/30" : "border-border/40"
                          }`}
                        >
                          <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                          {f.isUploading && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                            </div>
                          )}
                          {isSelected && !f.isUploading && (
                            <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </button>
                        <button
                          onClick={() => removeUploadedAvatar(f.id)}
                          className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Selection status */}
          {selectedAvatars.length > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {selectedCollectionAvatarData
                  ? `"${selectedCollectionAvatarData.name}" selected (${selectedAvatars.length} angle${selectedAvatars.length !== 1 ? "s" : ""})`
                  : `${selectedAvatars.length} custom presenter selected`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={onNext}
          disabled={!isValid}
          className="gradient-bg text-white hover:opacity-90 disabled:opacity-40 shadow-lg gap-2 px-6"
        >
          Continue to Script
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
