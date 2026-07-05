"use client";

import { useRef } from "react";

const CANVAS_W = 1080;
const CANVAS_H = 1920;

function OverlayHitBox({ overlay, containerRef, selected, onSelect, onMove, onLoadAspect }) {
  const dragRef = useRef(null);

  const heightPercent =
    overlay.type === "image"
      ? ((overlay.width / 100) * CANVAS_W * (overlay.aspect || 1)) / CANVAS_H * 100
      : (overlay.fontSize * 1.4) / CANVAS_H * 100;

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(overlay.id);
    const rect = containerRef.current.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startXPct: overlay.x,
      startYPct: overlay.y,
      rectW: rect.width,
      rectH: rect.height,
    };

    const handleMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const dxPct = ((ev.clientX - d.startX) / d.rectW) * 100;
      const dyPct = ((ev.clientY - d.startY) / d.rectH) * 100;
      onMove(overlay.id, {
        x: Math.min(100, Math.max(0, d.startXPct + dxPct)),
        y: Math.min(100, Math.max(0, d.startYPct + dyPct)),
      });
    };
    const handleUp = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      className={`absolute cursor-grab active:cursor-grabbing rounded-sm transition-shadow ${
        selected ? "ring-2 ring-[#c7f038]" : "hover:ring-2 hover:ring-white/60"
      }`}
      style={{
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        width: `${overlay.width}%`,
        height: `${heightPercent}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      {overlay.type === "image" && !overlay.aspect && (
        <img
          src={overlay.url}
          alt=""
          className="hidden"
          onLoad={(e) => {
            const { naturalWidth, naturalHeight } = e.currentTarget;
            if (naturalWidth > 0) onLoadAspect(overlay.id, naturalHeight / naturalWidth);
          }}
        />
      )}
    </div>
  );
}

/**
 * Transparent drag layer overlaid on the Remotion <Player> canvas — lets the
 * user reposition overlays by dragging. The actual visible text/image is
 * rendered inside the composition itself (SeedanceReelComposition); this
 * layer only draws selection/drag hitboxes at the same percent-based
 * coordinates so it stays perfectly aligned at any canvas size.
 */
export function OverlaysCanvasLayer({ containerRef, overlays, selectedId, onSelect, onMove, onLoadAspect }) {
  return (
    <div className="absolute inset-0" onPointerDown={() => onSelect(null)}>
      {overlays.map((o) => (
        <OverlayHitBox
          key={o.id}
          overlay={o}
          containerRef={containerRef}
          selected={selectedId === o.id}
          onSelect={onSelect}
          onMove={onMove}
          onLoadAspect={onLoadAspect}
        />
      ))}
    </div>
  );
}
