"use client";

import { useState, useCallback } from "react";
import { Upload, X, CheckCircle2, ImagePlus, Info, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

async function uploadToR2(file, uploadEndpoint) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("name", file.name || "Property Photo");
  fd.append("type", "background");
  fd.append("category", "property-photos");

  const res = await fetch(uploadEndpoint, { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data.asset.url;
}

// Shared "Add Assets" tile — property/location photo upload. Used by every
// template's Add Assets step; only the max count and helper copy differ.
//
// Every photo is uploaded to R2 as soon as it's added, so `images` entries
// carry a `r2Url` (the public, permanent URL) alongside the local blob
// preview. That `r2Url` is what downstream steps (e.g. the script generator,
// which grounds its image_prompts in the real property photos) read —
// blob URLs only exist in this browser tab and can't be sent to an API.
export function PropertyImages({
  images,
  setImages,
  max = 10,
  helpHref = "/dashboard/guide/upload-property",
  uploadEndpoint = "/api/assets/upload",
}) {
  const [dragging, setDragging] = useState(false);

  const uploadOne = useCallback(
    async (id, file) => {
      try {
        const r2Url = await uploadToR2(file, uploadEndpoint);
        setImages((prev) => prev.map((img) => (img.id === id ? { ...img, r2Url, uploading: false } : img)));
      } catch (err) {
        setImages((prev) => prev.map((img) => (img.id === id ? { ...img, uploading: false, uploadError: true } : img)));
        toast.error("Photo upload failed", { description: err.message });
      }
    },
    [setImages, uploadEndpoint]
  );

  const handleFiles = useCallback(
    (files) => {
      const validFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (validFiles.length === 0) return toast.error("Please upload image files.");
      if (images.length + validFiles.length > max) {
        return toast.error(`Maximum ${max} photos allowed.`);
      }
      const withPreview = validFiles.map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file: f,
        url: URL.createObjectURL(f),
        name: f.name,
        uploading: true,
      }));
      setImages((prev) => [...prev, ...withPreview]);
      withPreview.forEach((img) => uploadOne(img.id, img.file));
    },
    [images, setImages, max, uploadOne]
  );

  const removeImage = (idx) => {
    setImages((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx]?.url);
      next.splice(idx, 1);
      return next;
    });
  };

  const uploadedCount = images.filter((img) => img.r2Url).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center">
          <ImagePlus className="w-4 h-4 text-[#c7f03b]" />
        </div>
        <h3 className="text-sm font-semibold">Property Photos</h3>
        <span className="ml-auto text-xs font-medium text-neutral-500">
          {images.length}/{max}
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`relative border-2 border-dashed rounded-3xl transition-all ${
          dragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : images.length === 0
            ? "border-border hover:border-[#c7f038] bg-muted/20 hover:bg-muted/30"
            : "border-border/40 bg-muted/10"
        }`}
      >
        {images.length === 0 ? (
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
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        ) : (
          <div className="p-3 space-y-2">
            <div className="max-h-64 overflow-y-auto overscroll-contain scrollbar-hide" onWheel={(e) => e.stopPropagation()}>
              <div className="grid grid-cols-3 gap-2">
                {images.map((img, idx) => (
                  <div key={img.id || idx} className="relative group aspect-square rounded-xl overflow-hidden border border-border/30">
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" />

                    {img.uploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      </div>
                    )}
                    {img.uploadError && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center" title="Upload failed">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                      </div>
                    )}
                    {img.r2Url && (
                      <div className="absolute bottom-1 left-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      </div>
                    )}

                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {images.length < max && (
                  <label className="aspect-square rounded-xl border-2 border-dashed border-border/50 flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
                    <ImagePlus className="w-5 h-5 text-muted-foreground" />
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFiles(e.target.files)}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {images.length > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>
            {uploadedCount}/{images.length} photo{images.length !== 1 ? "s" : ""} uploaded
          </span>
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="absolute inset-y-0 left-0 w-1 bg-[#c7f038]" />
        <div className="pl-3 flex items-center gap-3">
          <Info className="h-5 w-5 text-black shrink-0" />
          <p className="text-xs text-neutral-600 leading-relaxed">
            Upload 2–{max} property photos. All photos are used as background context for the avatar video.{" "}
            <a href={helpHref} className="text-primary font-medium underline hover:opacity-80">
              Learn how to upload property photos
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
