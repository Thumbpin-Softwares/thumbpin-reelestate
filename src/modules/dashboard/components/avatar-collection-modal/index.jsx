"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

import { Upload, ImagePlus, Loader2, X } from "lucide-react";

const STEPS = [
  "Front portrait",
  "Side profile",
  "Full-body photo",
  "Smiling pose",
];
const MAX = STEPS.length;

export function AvatarCollectionModal({ open, onClose, onUploaded }) {
  const [items, setItems] = useState(Array(MAX).fill(null));
  const [collectionName, setCollectionName] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const filledItems = items.filter(Boolean);
  const currentStep = items.findIndex((x) => x === null);

  function addFiles(files) {
    const valid = Array.from(files).filter(
      (f) => ALLOWED_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE
    );

    setItems((prev) => {
      const next = [...prev];
      for (const f of valid) {
        const idx = next.findIndex((x) => x === null);
        if (idx === -1) break;
        next[idx] = { file: f, preview: URL.createObjectURL(f) };
      }
      return next;
    });
  }

  function removeItem(i) {
    setItems((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.map((item, idx) => (idx === i ? null : item));
    });
  }

  async function handleUpload() {
    if (!filledItems.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      filledItems.forEach((item, i) => fd.append(`presenterImage_${i}`, item.file));
      fd.append("name", collectionName.trim() || `My Avatars — ${new Date().toLocaleDateString()}`);

      const res = await fetch("/api/veo-long-ad/presenter/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      toast.success(`Collection "${data.name}" saved!`);
      onUploaded();
      handleClose();
    } catch (err) {
      toast.error("Upload failed", { description: err.message });
    } finally {
      setUploading(false);
    }
  }

  function handleClose() {
    if (uploading) return;
    items.forEach((it) => it && URL.revokeObjectURL(it.preview));
    setItems(Array(MAX).fill(null));
    setCollectionName("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImagePlus className="w-4 h-4" />
            Add Your Avatar Collection
          </DialogTitle>
          <DialogDescription>
            Upload four photos of the same person to create a realistic avatar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-4">
            <div className="flex items-center gap-2 justify-center">
              <div className="text-sm font-medium bg-[#c7f038] px-4 py-2 rounded-full">
                Step {currentStep === -1 ? MAX : currentStep + 1} of {MAX}
              </div>
              <div className="font-medium">
                {currentStep === -1
                  ? "All reference photos uploaded"
                  : `Add a ${STEPS[currentStep]}`}
              </div>
            </div>

            {currentStep !== -1 && (
              <div
                className="rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => inputRef.current?.click()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(e.dataTransfer.files);
                }}
                onDragOver={(e) => e.preventDefault()}
              >
                <ImagePlus className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium">Upload your {STEPS[currentStep]}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  JPEG, PNG, WebP are allowed and max size is 10 MB each.
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
              </div>
            )}
          </div>

          {/* Preview grid */}
          {filledItems.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {items.map((item, i) => 
                item ? (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                    <img src={item.preview} alt="" className="w-full h-full object-cover" />
                    {!uploading && (
                      <button
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeItem(i)}
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    )}
                    {uploading && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                ) : null
              )}
            </div>
          )}

          {/* Collection name */}
          {filledItems.length > 0 && (
            <Input
              placeholder="Enter collection name"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              disabled={uploading}
            />
          )}

          <Button
            className="w-full bg-[#c7f038] text-black hover:bg-[#c7f038] cursor-pointer"
            onClick={handleUpload}
            disabled={filledItems.length === 0 || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading collection...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Save as Collection{filledItems.length > 0 ? ` (${filledItems.length} photo${filledItems.length !== 1 ? "s" : ""})` : ""}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
