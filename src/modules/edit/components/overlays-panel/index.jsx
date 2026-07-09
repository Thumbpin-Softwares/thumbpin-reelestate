"use client";

import { useRef, useState } from "react";
import { Eye, EyeOff, GripVertical, ImagePlus, Loader2, Trash2, Type } from "lucide-react";
import { toast } from "sonner";
import { OVERLAY_FONTS } from "@/lib/remotion/overlay-fonts";

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
  onToggleHidden,
  onReorder,
  uploading,
}) {
  const fileInputRef = useRef(null);
  const selected = overlays.find((o) => o.id === selectedId) || null;

  // Layers are listed front-to-back (top of the list = top of the stack),
  // which is the reverse of `overlays` (storage order: last = frontmost).
  const layers = [...overlays].reverse();
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

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

  const handleDrop = (targetId) => {
    setOverId(null);
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const reordered = [...layers];
    const fromIdx = reordered.findIndex((o) => o.id === dragId);
    const toIdx = reordered.findIndex((o) => o.id === targetId);
    if (fromIdx === -1 || toIdx === -1) { setDragId(null); return; }
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    onReorder([...reordered].reverse()); // back to storage order
    setDragId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Add text or an image, then drag it anywhere on the canvas it stays there for the whole video.
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

      {layers.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">
            Layers
          </label>
          {layers.map((o) => (
            <div
              key={o.id}
              draggable
              onDragStart={() => setDragId(o.id)}
              onDragOver={(e) => { e.preventDefault(); setOverId(o.id); }}
              onDragLeave={() => setOverId((prev) => (prev === o.id ? null : prev))}
              onDrop={(e) => { e.preventDefault(); handleDrop(o.id); }}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
              onClick={() => onSelect(o.id)}
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left transition-colors cursor-pointer ${
                selectedId === o.id
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-border/50 hover:bg-muted/40"
              } ${overId === o.id && dragId !== o.id ? "border-dashed border-[#c7f038]" : ""} ${
                dragId === o.id ? "opacity-40" : ""
              } ${o.hidden ? "opacity-50" : ""}`}
            >
              <GripVertical className="w-3.5 h-3.5 shrink-0 opacity-50 cursor-grab" />
              <span className="flex items-center gap-1.5 text-xs font-medium truncate flex-1">
                {o.type === "image" ? <ImagePlus className="w-3.5 h-3.5 shrink-0" /> : <Type className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">{o.type === "image" ? "Image" : o.text || "Text"}</span>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHidden(o.id);
                }}
                className="shrink-0 opacity-70 hover:opacity-100"
              >
                {o.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <Trash2
                className="w-3.5 h-3.5 shrink-0 opacity-70 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(o.id);
                }}
              />
            </div>
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
                <label className="text-[11px] font-medium text-muted-foreground">Font</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {OVERLAY_FONTS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => onUpdate(selected.id, { fontFamily: f.id })}
                      style={{ fontFamily: f.css }}
                      className={`rounded-lg border px-2 py-1.5 text-xs truncate transition-colors ${
                        (selected.fontFamily || "sans") === f.id
                          ? "bg-[#c7f038] border-[#c7f038] text-black"
                          : "border-border/50 hover:bg-neutral-300/40 duration-300"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
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
                  className="accent-[#c7f038]"
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

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Background ({selected.bgOpacity || 0}%)
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={selected.bgOpacity || 0}
                  onChange={(e) => onUpdate(selected.id, { bgOpacity: Number(e.target.value) })}
                  className="accent-[#c7f038]"
                />
                {(selected.bgOpacity || 0) > 0 && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      type="color"
                      value={/^#([0-9a-f]{6})$/i.test(selected.bgColor) ? selected.bgColor : "#000000"}
                      onChange={(e) => onUpdate(selected.id, { bgColor: e.target.value })}
                      className="w-7 h-7 rounded-md border border-border/50 cursor-pointer p-0 bg-transparent"
                    />
                    <input
                      type="text"
                      value={selected.bgColor || "#000000"}
                      onChange={(e) => {
                        const v = e.target.value;
                        onUpdate(selected.id, { bgColor: v.startsWith("#") ? v : `#${v}` });
                      }}
                      placeholder="#000000"
                      maxLength={7}
                      className="flex-1 rounded-lg border border-border/50 bg-white px-2 py-1.5 text-xs font-mono uppercase"
                    />
                  </div>
                )}
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
                className="accent-[#c7f038]"
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
