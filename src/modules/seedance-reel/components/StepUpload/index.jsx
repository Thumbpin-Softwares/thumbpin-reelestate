"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Upload,
  X,
  CheckCircle2,
  ImagePlus,
  User2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Info,
  Plus,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * StepUpload — Step 0 for the Seedance Reel pipeline.
 *
 * Simplified from veo-long-ad/StepUpload:
 * - Keeps: location images (max 4) + avatar selector (prebuilt / upload / my-assets)
 * - Removed: background image upload (Seedance uses location images as environment reference)
 */
export function StepUpload({
  locationImages,
  setLocationImages,
  avatarHook,
  onNext,
  isValid,
  orderHint,
}) {
  const [draggingLocation, setDraggingLocation] = useState(false);
  const [previewCollection, setPreviewCollection] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [loadedPreviewUrls, setLoadedPreviewUrls] = useState(() => new Set());
  const touchStartXRef = useRef(null);

  // Preload every photo in the collection as soon as the preview opens so
  // swiping/clicking through them doesn't wait on a fresh network fetch.
  useEffect(() => {
    if (!previewCollection?.images?.length) return;
    let cancelled = false;
    setLoadedPreviewUrls(new Set());
    previewCollection.images.forEach((img) => {
      if (!img.url) return;
      const el = new window.Image();
      el.onload = () => {
        if (cancelled) return;
        setLoadedPreviewUrls((prev) => {
          if (prev.has(img.url)) return prev;
          const next = new Set(prev);
          next.add(img.url);
          return next;
        });
      };
      el.src = img.url;
    });
    return () => { cancelled = true; };
  }, [previewCollection]);

  const handlePreviewTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handlePreviewTouchEnd = (e) => {
    const startX = touchStartXRef.current;
    const count = previewCollection?.images?.length || 0;
    touchStartXRef.current = null;
    if (startX === null || count < 2) return;

    const deltaX = e.changedTouches[0].clientX - startX;
    const SWIPE_THRESHOLD = 40;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;

    if (deltaX < 0) setPreviewIndex((i) => (i + 1) % count);
    else setPreviewIndex((i) => (i - 1 + count) % count);
  };
  const [uploadItems, setUploadItems] = useState([]);
  const [collectionName, setCollectionName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const MAX_COLLECTION = 4;

  const [myAssets, setMyAssets] = useState([]);
  const [myAssetsLoading, setMyAssetsLoading] = useState(false);

  useEffect(() => {
    if (avatarHook.avatarMode !== "my-assets") return;
    if (myAssets.length > 0) return;
    setMyAssetsLoading(true);
    fetch("/api/assets")
      .then((r) => r.json())
      .then((data) => {
        const all = (data.assets || []).filter(
          (a) => a.type === "avatar" || a.type === "presenter",
        );
        const normalised = all.map((a) => {
          const urls = a.metadata?.urls || [a.url];
          return {
            id: a._id,
            name: a.name,
            coverImage: urls[0],
            images: urls.map((url) => ({ url, key: url })),
          };
        });
        setMyAssets(normalised);
      })
      .catch(() => {})
      .finally(() => setMyAssetsLoading(false));
  }, [avatarHook.avatarMode]);

  const handleLocationFiles = useCallback(
    (files) => {
      const validFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (validFiles.length === 0) return toast.error("Please upload image files.");
      if (locationImages.length + validFiles.length > 10) {
        return toast.error("Maximum 10 location images allowed.");
      }
      const withPreview = validFiles.map((f) => ({
        file: f,
        url: URL.createObjectURL(f),
        name: f.name,
      }));
      setLocationImages((prev) => [...prev, ...withPreview]);
    },
    [locationImages, setLocationImages],
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

  const {
    reAvatars,
    reAvatarsLoading,
    selectedAvatars,
    selectCollection,
    isCollectionSelected,
  } = avatarHook;

  const selectedCollectionAvatarData = reAvatars.find((col) =>
    isCollectionSelected(col.id),
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid md:grid-cols-2 gap-6">
        {/* ── Left: Location Images ───────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center">
              <ImagePlus className="w-4 h-4 text-[#c7f03b]" />
            </div>
            <h3 className="text-sm font-semibold">Property Photos</h3>
            <span className="ml-auto text-xs font-medium text-neutral-500">
              {locationImages.length}/10
            </span>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDraggingLocation(true); }}
            onDragLeave={() => setDraggingLocation(false)}
            onDrop={onDropLocation}
            className={`relative border-2 border-dashed rounded-3xl transition-all ${
              draggingLocation
                ? "border-primary bg-primary/5 scale-[1.01]"
                : locationImages.length === 0
                ? "border-border hover:border-[#c7f038] bg-muted/20 hover:bg-muted/30"
                : "border-border/40 bg-muted/10"
            }`}
          >
            {locationImages.length === 0 ? (
              <label className="flex flex-col items-center gap-3 py-10 cursor-pointer">
                <div className="w-12 h-12 rounded-2xl bg-neutral-900 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-[#c7f03b]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Drop photos here or click to upload</p>
                  <p className="text-xs text-neutral-500 my-1">PNG, JPG, WEBP up to 10MB each</p>
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
                <div
                  className="max-h-64 overflow-y-auto overscroll-contain scrollbar-hide"
                  onWheel={(e) => e.stopPropagation()}
                >
                <div className="grid grid-cols-3 gap-2">
                  {locationImages.map((img, idx) => (
                    <div
                      key={idx}
                      className="relative group aspect-square rounded-xl overflow-hidden border border-border/30"
                    >
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeLocation(idx)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {locationImages.length < 10 && (
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
              </div>
            )}
          </div>

          {locationImages.length > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{locationImages.length} photo{locationImages.length !== 1 ? "s" : ""} added</span>
            </div>
          )}

          <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="absolute inset-y-0 left-0 w-1 bg-[#c7f038]" />
            <div className="pl-3 flex items-center gap-3">
              <Info className="h-5 w-5 text-black shrink-0" />
              <p className="text-xs text-neutral-600 leading-relaxed">
                {orderHint === "location-first"
                  ? "Upload 2–10 property photos. Property photos are sent to the AI first, then presenter photos — that exact order is referenced inside the generated video prompts."
                  : "Upload 2–10 property photos. All photos are used as background context for the avatar video."}
              </p>
            </div>
          </div>
        </div>

        {/* ── Right: Avatar / Presenter ─────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center">
              <User2 className="w-4 h-4 text-[#c7f038]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Presenter / Avatar</h3>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {[
              { id: "prebuilt", label: "RE Agents" },
              { id: "upload", label: "Upload Presenter" },
              { id: "my-assets", label: "My Assets" },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => avatarHook.setAvatarMode(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  avatarHook.avatarMode === id
                    ? "bg-primary text-white shadow"
                    : "border border-border/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Prebuilt avatars */}
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
                <div
                  className="max-h-74 overflow-y-auto overscroll-contain scrollbar-hide pr-1"
                  onWheel={(e) => e.stopPropagation()}
                >
                  <div className="grid grid-cols-2 gap-2">
                    {reAvatars.map((col) => {
                      const selected = isCollectionSelected(col.id);
                      const thumb = col.coverImage || col.images?.[0]?.url;
                      return (
                        <div
                          key={col.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => selectCollection(col)}
                          onKeyDown={(e) => e.key === "Enter" && selectCollection(col)}
                          className={`group relative rounded-3xl overflow-hidden border-2 transition-all text-left cursor-pointer ${
                            selected
                              ? "border-[#c7f038] ring-2 ring-[#c7f038] scale-[1.02]"
                              : "border-border/40 hover:border-[#c7f038]"
                          }`}
                        >
                          {thumb ? (
                            <img src={thumb} alt={col.name} className="w-full h-64 object-cover" />
                          ) : (
                            <div className="w-full h-64 bg-muted/30 flex items-center justify-center">
                              <User2 className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setPreviewCollection(col); setPreviewIndex(0); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black text-xs font-medium shadow-lg hover:bg-[#c7f038] transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </button>
                          </div>
                          {selected && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-neutral-900 flex items-center justify-center">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#c7f038]" />
                            </div>
                          )}
                          <p className="absolute bottom-2 left-2 right-2 text-[11px] text-white font-medium truncate">
                            {col.name}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upload avatars */}
          {avatarHook.avatarMode === "upload" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {uploadItems.map((item, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-border/40">
                    <img src={item.preview} alt={`Presenter ${idx + 1}`} className="w-full h-full object-cover" />
                    {uploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      </div>
                    )}
                    {!uploading && (
                      <button
                        onClick={() => setUploadItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                {uploadItems.length < MAX_COLLECTION && (
                  <label
                    className={`aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all hover:border-[#c7f038] hover:bg-[#c7f038]/5 ${
                      uploadItems.length === 0 ? "col-span-2 py-8 border-border" : "border-border/50"
                    }`}
                  >
                    <Plus className="w-5 h-5 text-neutral-500" />
                    {uploadItems.length === 0 && (
                      <>
                        <p className="text-sm font-medium">Add presenter photos</p>
                        <p className="text-[11px] text-muted-foreground">Up to 4 images per collection</p>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const picked = Array.from(e.target.files || []);
                        const remaining = MAX_COLLECTION - uploadItems.length;
                        const toAdd = picked.slice(0, remaining).map((f) => ({
                          file: f,
                          preview: URL.createObjectURL(f),
                        }));
                        setUploadItems((prev) => [...prev, ...toAdd]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>

              {uploadItems.length > 0 && (
                <>
                  <Input
                    placeholder="Collection name (optional)"
                    value={collectionName}
                    onChange={(e) => setCollectionName(e.target.value)}
                    className="text-sm h-9"
                  />
                  <Button
                    size="sm"
                    className="w-full gradient-bg text-white hover:opacity-90 gap-2"
                    disabled={uploading}
                    onClick={async () => {
                      setUploading(true);
                      try {
                        const fd = new FormData();
                        uploadItems.forEach((item, i) => fd.append(`presenterImage_${i}`, item.file));
                        fd.append(
                          "name",
                          collectionName.trim() || `My Presenter — ${new Date().toLocaleDateString()}`,
                        );
                        const res = await fetch("/api/veo-long-ad/presenter/upload", {
                          method: "POST",
                          body: fd,
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "Upload failed");
                        toast.success(`Collection "${data.name}" saved!`);
                        avatarHook.selectCollection({
                          id: data.assetId,
                          name: data.name,
                          coverImage: data.urls[0],
                          images: data.urls.map((url) => ({ url, key: url })),
                        });
                        setUploadItems([]);
                        setCollectionName("");
                      } catch (err) {
                        toast.error("Upload failed", { description: err.message });
                      } finally {
                        setUploading(false);
                      }
                    }}
                  >
                    {uploading ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
                    ) : (
                      <><Upload className="w-3.5 h-3.5" /> Upload as Collection</>
                    )}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* My Assets */}
          {avatarHook.avatarMode === "my-assets" && (
            <div className="space-y-2">
              {myAssetsLoading ? (
                <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading your assets...
                </div>
              ) : myAssets.length === 0 ? (
                <div className="text-center py-6 space-y-1">
                  <p className="text-sm text-muted-foreground">No avatars uploaded yet.</p>
                  <p className="text-xs text-muted-foreground">Upload avatar photos in your Asset Library first.</p>
                </div>
              ) : (
                <div
                  className="max-h-72 overflow-y-auto no-scrollbar overscroll-contain pr-1"
                  onWheel={(e) => e.stopPropagation()}
                >
                  <div className="grid grid-cols-2 gap-2">
                    {myAssets.map((col) => {
                      const selected = avatarHook.isCollectionSelected(col.id);
                      const thumb = col.coverImage || col.images?.[0]?.url;
                      return (
                        <div
                          key={col.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => avatarHook.selectCollection(col)}
                          onKeyDown={(e) => e.key === "Enter" && avatarHook.selectCollection(col)}
                          className={`group relative rounded-3xl overflow-hidden border-2 transition-all text-left cursor-pointer ${
                            selected
                              ? "border-[#c7f038] ring-2 ring-[#c7f038] scale-[1.02]"
                              : "border-border/40 hover:border-[#c7f038]"
                          }`}
                        >
                          {thumb ? (
                            <img src={thumb} alt={col.name} className="w-full h-64 object-cover" />
                          ) : (
                            <div className="w-full h-64 bg-muted/30 flex items-center justify-center">
                              <User2 className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setPreviewCollection(col); setPreviewIndex(0); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black text-xs font-medium shadow-lg hover:bg-[#c7f038] transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </button>
                          </div>
                          {col.images?.length > 1 && (
                            <div className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-1 text-[10px] text-white">
                              {col.images.length} photos
                            </div>
                          )}
                          {selected && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-neutral-900 flex items-center justify-center">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#c7f038]" />
                            </div>
                          )}
                          <p className="absolute bottom-2 left-2 right-2 text-[11px] text-white font-medium truncate">
                            {col.name}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

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

      <div className="flex justify-center sm:justify-end pt-2">
        <Button
          onClick={onNext}
          disabled={!isValid}
          className="bg-neutral-900 text-[#c7f038] hover:opacity-90 hover:bg-neutral-900 disabled:opacity-70 shadow-lg gap-2 px-6"
        >
          Continue to Script
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Collection photo preview — carousel */}
      <Dialog open={!!previewCollection} onOpenChange={(open) => !open && setPreviewCollection(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{previewCollection?.name}</DialogTitle>
          </DialogHeader>
          {previewCollection?.images?.length > 0 && (
            <div className="space-y-3">
              <div
                className="relative h-64 rounded-xl overflow-hidden border border-border/40 bg-muted touch-pan-y"
                onTouchStart={handlePreviewTouchStart}
                onTouchEnd={handlePreviewTouchEnd}
              >
                <img
                  src={previewCollection.images[previewIndex]?.url}
                  alt={`${previewCollection.name} ${previewIndex + 1}`}
                  className="w-full h-full object-contain"
                />

                {!loadedPreviewUrls.has(previewCollection.images[previewIndex]?.url) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/60">
                    <Loader2 className="w-5 h-5 animate-spin text-neutral-500" />
                  </div>
                )}

                {previewCollection.images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewIndex((i) => (i - 1 + previewCollection.images.length) % previewCollection.images.length)
                      }
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                      title="Previous photo"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewIndex((i) => (i + 1) % previewCollection.images.length)
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                      title="Next photo"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>

              {previewCollection.images.length > 1 && (
                <div className="flex items-center justify-center gap-1.5">
                  {previewCollection.images.map((img, idx) => (
                    <button
                      key={img.key || img.url || idx}
                      type="button"
                      onClick={() => setPreviewIndex(idx)}
                      title={`Photo ${idx + 1}`}
                      className={`h-2 rounded-full transition-all ${
                        idx === previewIndex ? "w-6 bg-neutral-900" : "w-2 bg-neutral-300 hover:bg-neutral-400"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
