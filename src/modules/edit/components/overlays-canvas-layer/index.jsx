"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { getOverlayFontCss, hexToRgba } from "@/lib/remotion/overlay-fonts";

const CANVAS_W = 1080;
const CANVAS_H = 1920;

function OverlayHitBox({ overlay, containerRef, selected, editing, onSelect, onMove, onLoadAspect, onStartEdit, onEditChange, onStopEdit }) {
  const dragRef = useRef(null);
  const measureRef = useRef(null);
  const [textHeightPercent, setTextHeightPercent] = useState(null);

  // Text boxes wrap, so a fixed single-line estimate doesn't match multi-line
  // content. Measure the real rendered height with an invisible mirror div
  // (same width/font/padding), then convert its pixel height to a percent of
  // the container so the highlight tracks the actual text block.
  useLayoutEffect(() => {
    if (overlay.type !== "text" || !measureRef.current || !containerRef.current) return;

    const measure = () => {
      const containerH = containerRef.current.getBoundingClientRect().height;
      const measuredPx = measureRef.current.getBoundingClientRect().height;
      if (containerH > 0) setTextHeightPercent((measuredPx / containerH) * 100);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(measureRef.current);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [overlay.type, overlay.text, overlay.fontSize, overlay.width, overlay.fontFamily, overlay.bgOpacity, containerRef]);

  const heightPercent =
    overlay.type === "image"
      ? ((overlay.width / 100) * CANVAS_W * (overlay.aspect || 1)) / CANVAS_H * 100
      : textHeightPercent ?? (overlay.fontSize * 1.4) / CANVAS_H * 100;

  const handlePointerDown = (e) => {
    if (editing) return;
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

  const style = {
    left: `${overlay.x}%`,
    top: `${overlay.y}%`,
    width: `${overlay.width}%`,
    height: `${heightPercent}%`,
    transform: "translate(-50%, -50%)",
  };

  const textMirrorStyle = {
    left: `${overlay.x}%`,
    width: `${overlay.width}%`,
    boxSizing: "border-box",
    fontSize: `${(overlay.fontSize / CANVAS_H) * 50}vh`,
    fontWeight: 700,
    fontFamily: getOverlayFontCss(overlay.fontFamily),
    whiteSpace: "pre-wrap",
    textAlign: "center",
    padding: overlay.bgOpacity ? "0.3em 0.5em" : 0,
  };

  // Invisible mirror of the real text block, used only to measure its
  // wrapped height (see the effect above) — never shown to the user.
  const measurer = overlay.type === "text" && (
    <div
      ref={measureRef}
      aria-hidden
      className="absolute pointer-events-none invisible"
      style={{ ...textMirrorStyle, top: 0 }}
    >
      {overlay.text}
    </div>
  );

  if (overlay.type === "text" && editing) {
    return (
      <>
        {measurer}
        <textarea
          autoFocus
          value={overlay.text}
          onChange={(e) => onEditChange(overlay.id, e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={onStopEdit}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.currentTarget.blur(); }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute resize-none bg-transparent outline-none ring-2 ring-[#c7f038] rounded-sm text-center"
          style={{
            ...style,
            boxSizing: "border-box",
            fontSize: `${(overlay.fontSize / CANVAS_H) * 100}vh`,
            color: overlay.color || "#ffffff",
            fontWeight: 700,
            fontFamily: getOverlayFontCss(overlay.fontFamily),
            backgroundColor: hexToRgba(overlay.bgColor, overlay.bgOpacity),
            padding: overlay.bgOpacity ? "0.3em 0.5em" : 0,
            borderRadius: overlay.bgOpacity ? 12 : 0,
          }}
        />
      </>
    );
  }

  return (
    <>
      {measurer}
      <div
        onPointerDown={handlePointerDown}
        onDoubleClick={(e) => {
          if (overlay.type !== "text") return;
          e.preventDefault();
          e.stopPropagation();
          onStartEdit(overlay.id);
        }}
        className={`absolute cursor-grab active:cursor-grabbing rounded-sm transition-shadow ${
          selected ? "ring-2 ring-[#c7f038]" : "hover:ring-2 hover:ring-white/60"
        }`}
        style={style}
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
    </>
  );
}

/**
 * Transparent drag layer overlaid on the Remotion <Player> canvas — lets the
 * user reposition overlays by dragging. The actual visible text/image is
 * rendered inside the composition itself (SeedanceReelComposition); this
 * layer only draws selection/drag hitboxes at the same percent-based
 * coordinates so it stays perfectly aligned at any canvas size.
 *
 * Double-clicking a text overlay swaps its hitbox for a real <textarea> so
 * the text can be edited directly on the canvas (WYSIWYG), instead of only
 * through the side panel.
 */
export function OverlaysCanvasLayer({
  containerRef,
  overlays,
  selectedId,
  editingId,
  onSelect,
  onMove,
  onLoadAspect,
  onStartEdit,
  onEditChange,
  onStopEdit,
}) {
  return (
    <div className="absolute inset-0" onPointerDown={() => onSelect(null)}>
      {overlays.map((o) => (
        <OverlayHitBox
          key={o.id}
          overlay={o}
          containerRef={containerRef}
          selected={selectedId === o.id}
          editing={editingId === o.id}
          onSelect={onSelect}
          onMove={onMove}
          onLoadAspect={onLoadAspect}
          onStartEdit={onStartEdit}
          onEditChange={onEditChange}
          onStopEdit={onStopEdit}
        />
      ))}
    </div>
  );
}
