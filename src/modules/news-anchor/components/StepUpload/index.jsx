"use client";

import { useCallback, useState } from "react";
import {
  Upload,
  X,
  CheckCircle2,
  ImagePlus,
  ChevronRight,
  Video as VideoIcon,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MAX_ITEMS = 20;

/**
 * StepUpload — Step 0 for the News Anchor B-roll pipeline.
 *
 * Pure-media collector: no AI, no avatar/presenter selection. The user
 * uploads their own photos and/or video clips, in the order they want them
 * to appear in the montage — that's the only input StepBroll needs.
 */
export function StepUpload({ mediaItems, setMediaItems, onNext, isValid, onClear }) {
  const [dragging, setDragging] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleFiles = useCallback(
    (files) => {
      const validFiles = Array.from(files).filter(
        (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
      );
      if (validFiles.length === 0) {
        return toast.error("Please upload image or video files.");
      }
      if (mediaItems.length + validFiles.length > MAX_ITEMS) {
        return toast.error(`Maximum ${MAX_ITEMS} media items allowed.`);
      }
      const withPreview = validFiles.map((f) => ({
        file: f,
        url: URL.createObjectURL(f),
        name: f.name,
        type: f.type.startsWith("video/") ? "video" : "image",
      }));
      setMediaItems((prev) => [...prev, ...withPreview]);
    },
    [mediaItems, setMediaItems],
  );

  const removeItem = (idx) => {
    setMediaItems((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx]?.url);
      next.splice(idx, 1);
      return next;
    });
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="max-w-2xl mx-auto space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center">
            <ImagePlus className="w-4 h-4 text-[#c7f038]" />
          </div>
          <h3 className="text-sm font-semibold">B-Roll Media</h3>
          <span className="ml-auto text-xs font-medium text-neutral-500">
            {mediaItems.length}/{MAX_ITEMS}
          </span>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`relative border-2 border-dashed rounded-3xl transition-all ${
            dragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : mediaItems.length === 0
                ? "border-border hover:border-[#c7f038] bg-muted/20 hover:bg-muted/30"
                : "border-border/40 bg-muted/10"
          }`}
        >
          {mediaItems.length === 0 ? (
            <label className="flex flex-col items-center gap-3 py-14 cursor-pointer">
              <div className="w-12 h-12 rounded-2xl bg-neutral-900 flex items-center justify-center">
                <Upload className="w-5 h-5 text-[#c7f038]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Drop photos/videos here or click to upload</p>
                <p className="text-xs text-neutral-500 my-1">
                  They&apos;ll appear in the montage in the order you add them
                </p>
              </div>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
          ) : (
            <div className="p-3">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {mediaItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="relative group aspect-square rounded-xl overflow-hidden border border-border/30 bg-black"
                  >
                    {item.type === "video" ? (
                      <video src={item.url} muted className="w-full h-full object-cover" />
                    ) : (
                      <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                    )}
                    {item.type === "video" && (
                      <div className="absolute top-1 left-1 rounded-full bg-black/70 p-1">
                        <VideoIcon className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-white font-medium">
                      {idx + 1}
                    </span>
                    <button
                      onClick={() => removeItem(idx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {mediaItems.length < MAX_ITEMS && (
                  <label className="aspect-square rounded-xl border-2 border-dashed border-border/50 flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
                    <ImagePlus className="w-5 h-5 text-muted-foreground" />
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(e) => handleFiles(e.target.files)}
                    />
                  </label>
                )}
              </div>
            </div>
          )}
        </div>

        {mediaItems.length > 0 && (
          <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{mediaItems.length} item{mediaItems.length !== 1 ? "s" : ""} added</span>
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto flex items-center justify-between pt-2">
        {onClear ? (
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="text-sm rounded-md text-white bg-red-500 px-6 py-2 transition-colors"
          >
            Clear all data
          </button>
        ) : (
          <span />
        )}

        <Button
          onClick={onNext}
          disabled={!isValid}
          className="bg-neutral-900 text-[#c7f038] hover:opacity-90 hover:bg-neutral-900 disabled:opacity-70 shadow-lg gap-2 px-6"
        >
          Continue to B-Roll
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Clear-all confirmation */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <DialogTitle>Clear all data?</DialogTitle>
            </div>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This clears all uploaded media for this reel. This can&apos;t be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowClearConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowClearConfirm(false);
                onClear();
              }}
            >
              Clear all data
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
