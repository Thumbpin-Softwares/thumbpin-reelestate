"use client";

import { useRef } from "react";
import { ImagePlus, Loader2, Trash2, Type } from "lucide-react";
import { toast } from "sonner";

const COLORS = ["#ffffff", "#000000", "#c7f038", "#ff4d4d", "#3b82f6", "#f59e0b"];

/**
 * Right-panel controls for the text/image overlay layer. The actual
 * dragging happens directly on the canvas (see OverlaysCanvasLayer); this
 * panel is for adding new overlays and editing the selected one's content.
 */
export function OverlaysPanel({
  overlays,
  selectedId,
  onSelect,
  onAddText,
  onAddImage,
  onUpdate,
  onRemove,
  uploading,
}) {
  const fileInputRef = useRef(null);
  const selected = overlays.find((o) => o.id === selectedId) || null;

  const handleImagePick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    await onAddImage(file);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Add text or an image, then drag it anywhere on the canvas — it stays there for the whole video.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onAddText}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border/50 py-2 text-xs font-medium hover:bg-muted/40 hover:border-border transition-colors"
        >
          <Type className="w-3.5 h-3.5" />
          Add text
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border/50 py-2 text-xs font-medium hover:bg-muted/40 hover:border-border transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
          Add image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImagePick}
        />
      </div>

      {overlays.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Layers</label>
          {overlays.map((o) => (
            <button
              key={o.id}
              onClick={() => onSelect(o.id)}
              className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                selectedId === o.id
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-border/50 hover:bg-muted/40"
              }`}
            >
              <span className="flex items-center gap-1.5 text-xs font-medium truncate">
                {o.type === "image" ? <ImagePlus className="w-3.5 h-3.5 shrink-0" /> : <Type className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">{o.type === "image" ? "Image" : o.text || "Text"}</span>
              </span>
              <Trash2
                className="w-3.5 h-3.5 shrink-0 opacity-70 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(o.id);
                }}
              />
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="flex flex-col gap-3 rounded-xl border border-border/50 p-3">
          {selected.type === "text" ? (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground">Text</label>
                <textarea
                  value={selected.text}
                  onChange={(e) => onUpdate(selected.id, { text: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-border/50 bg-white px-2 py-1.5 text-xs resize-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Size ({selected.fontSize}px)
                </label>
                <input
                  type="range"
                  min={20}
                  max={140}
                  value={selected.fontSize}
                  onChange={(e) => onUpdate(selected.id, { fontSize: Number(e.target.value) })}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground">Color</label>
                <div className="flex items-center gap-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => onUpdate(selected.id, { color: c })}
                      style={{ backgroundColor: c }}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        selected.color === c ? "border-neutral-900 scale-110" : "border-border/50"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="color"
                    value={/^#([0-9a-f]{6})$/i.test(selected.color) ? selected.color : "#ffffff"}
                    onChange={(e) => onUpdate(selected.id, { color: e.target.value })}
                    className="w-7 h-7 rounded-md border border-border/50 cursor-pointer p-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={selected.color}
                    onChange={(e) => {
                      const v = e.target.value;
                      onUpdate(selected.id, { color: v.startsWith("#") ? v : `#${v}` });
                    }}
                    placeholder="#ffffff"
                    maxLength={7}
                    className="flex-1 rounded-lg border border-border/50 bg-white px-2 py-1.5 text-xs font-mono uppercase"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Size ({selected.width}%)
              </label>
              <input
                type="range"
                min={10}
                max={100}
                value={selected.width}
                onChange={(e) => onUpdate(selected.id, { width: Number(e.target.value) })}
              />
            </div>
          )}

          <button
            onClick={() => onRemove(selected.id)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-destructive/30 text-destructive py-1.5 text-xs font-medium hover:bg-destructive/5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
