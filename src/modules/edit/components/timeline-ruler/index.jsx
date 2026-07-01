"use client";

import { useRef, useState } from "react";
import { Captions, Music, Scissors, Type } from "lucide-react";

const TOOLBAR_ACTIONS = [
  { id: "trim",     label: "Trim",                   Icon: Scissors },
  { id: "captions", label: "Captions",                Icon: Captions },
  { id: "music",    label: "Music",                   Icon: Music },
  { id: "overlays", label: "Text / Image Overlays",   Icon: Type },
];

const HANDLE_HIT_PX = 10;

export function Timeline({
  durationInFrames,
  frame,
  fps,
  onSeek,
  onToolbarAction,
  onTrimChange,
  captions  = [],
  music     = [],
  overlays  = [],
}) {
  // "trim" is selected by default so users land in trim mode immediately.
  const [activeAction, setActiveAction] = useState("trim");

  const [trimIn,  setTrimIn]  = useState(0);
  const [trimOut, setTrimOut] = useState(durationInFrames);
  // When durationInFrames first becomes valid, treat trimOut===0 as "not yet set"
  // and fall back to the full duration — no effect needed.
  const effectiveTrimOut = trimOut > 0 ? trimOut : durationInFrames;

  const totalSeconds   = durationInFrames / fps;
  const tickCount      = Math.ceil(totalSeconds) + 1;
  const playheadPct    = durationInFrames > 0 ? (frame / durationInFrames) * 100 : 0;
  const trimInPct      = durationInFrames > 0 ? (trimIn          / durationInFrames) * 100 : 0;
  const trimOutPct     = durationInFrames > 0 ? (effectiveTrimOut / durationInFrames) * 100 : 100;

  const scrubRef      = useRef(null);
  const dragging      = useRef(false);
  const draggingTrim  = useRef(null); // null | "in" | "out"

  const frameFromPointer = (e) => {
    const el = scrubRef.current;
    if (!el || durationInFrames === 0) return null;
    const { left, width } = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - left) / width));
    return Math.round(ratio * (durationInFrames - 1));
  };

  const onPointerDown = (e) => {
    const el = scrubRef.current;
    if (!el || durationInFrames === 0) return;

    if (activeAction === "trim") {
      const { left, width } = el.getBoundingClientRect();
      const pointerX = e.clientX - left;
      const inPx     = (trimIn  / durationInFrames) * width;
      const outPx    = (trimOut / durationInFrames) * width;

      if (Math.abs(pointerX - inPx) <= HANDLE_HIT_PX) {
        draggingTrim.current = "in";
        el.setPointerCapture(e.pointerId);
        return;
      }
      if (Math.abs(pointerX - outPx) <= HANDLE_HIT_PX) {
        draggingTrim.current = "out";
        el.setPointerCapture(e.pointerId);
        return;
      }
    }

    dragging.current = true;
    el.setPointerCapture(e.pointerId);
    const f = frameFromPointer(e);
    if (f !== null) onSeek(f);
  };

  const onPointerMove = (e) => {
    if (draggingTrim.current) {
      const f = frameFromPointer(e);
      if (f === null) return;
      if (draggingTrim.current === "in") {
        const next = Math.max(0, Math.min(f, effectiveTrimOut - 1));
        setTrimIn(next);
        onTrimChange?.({ trimIn: next, trimOut: effectiveTrimOut });
      } else {
        const next = Math.min(durationInFrames, Math.max(f, trimIn + 1));
        setTrimOut(next);
        onTrimChange?.({ trimIn, trimOut: next });
      }
      return;
    }
    if (dragging.current) {
      const f = frameFromPointer(e);
      if (f !== null) onSeek(f);
    }
  };

  const onPointerUp = () => {
    dragging.current    = false;
    draggingTrim.current = null;
  };

  const trackData   = { captions, music, overlays };
  const activeItems = (activeAction && activeAction !== "trim") ? (trackData[activeAction] ?? []) : [];
  const showTrack   = activeAction && activeAction !== "trim";
  const showTrim    = activeAction === "trim";

  return (
    <div className="w-full rounded-2xl border border-border/50 bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border/50">
        {TOOLBAR_ACTIONS.map(({ id, label, Icon }) => {
          const isActive = activeAction === id;
          return (
            <button
              key={id}
              onClick={() => {
                const next = isActive ? null : id;
                setActiveAction(next);
                onToolbarAction?.(next);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors
                ${isActive
                  ? "bg-neutral-900 text-[#c7f038]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          );
        })}

        {/* Trim time display — only shown when trim is active */}
        {activeAction === "trim" && durationInFrames > 0 && (
          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
            {formatTime(trimIn / fps)} – {formatTime(effectiveTrimOut / fps)}
          </span>
        )}
      </div>

      {/* Ruler + optional track */}
      <div className="flex">
        {/* Left label column — trim and other tracks */}
        {(showTrack || showTrim) && (
          <div className="w-28 shrink-0 border-r border-border/50">
            <div className="h-6 border-b border-border/40 bg-muted/30" />
            <div className="h-10 flex items-center px-3 text-[11px] text-muted-foreground font-medium capitalize">
              {activeAction}
            </div>
          </div>
        )}

        {/* Scrubable timeline area */}
        <div
          ref={scrubRef}
          className="flex-1 relative cursor-col-resize select-none overflow-x-auto"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* Time ruler */}
          <div className="relative h-6 border-b border-border/40 bg-muted/30">
            {Array.from({ length: tickCount }).map((_, i) => {
              const isMajor = i % 5 === 0;
              const pct = (i / Math.max(totalSeconds, 1)) * 100;
              return (
                <div
                  key={i}
                  className="absolute top-0 h-full flex flex-col items-start"
                  style={{ left: `${pct}%` }}
                >
                  <div className={`w-px ${isMajor ? "h-3 bg-border" : "h-1.5 bg-border/40"}`} />
                  {isMajor && (
                    <span className="text-[9px] text-muted-foreground ml-1 tabular-nums whitespace-nowrap">
                      {i === 0 ? "0:00" : `${Math.floor(i / 60)}:${String(i % 60).padStart(2, "0")}`}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Dim regions on the ruler when trim is active */}
            {showTrim && durationInFrames > 0 && (
              <>
                <div className="absolute inset-y-0 left-0 bg-black/20 pointer-events-none" style={{ width: `${trimInPct}%` }} />
                <div className="absolute inset-y-0 right-0 bg-black/20 pointer-events-none" style={{ left: `${trimOutPct}%` }} />
              </>
            )}
          </div>

          {/* Trim track row — same h-10 as other tracks */}
          {showTrim && (
            <div className="relative h-10 bg-white">
              {durationInFrames > 0 && (
                <>
                  {/* Dimmed region before in-point */}
                  <div
                    className="absolute inset-y-0 left-0 bg-black/10 pointer-events-none"
                    style={{ width: `${trimInPct}%` }}
                  />
                  {/* Active trim region bar */}
                  <div
                    className="absolute inset-y-2 bg-[#c7f038]/30 border border-[#c7f038]/60 rounded-sm pointer-events-none"
                    style={{ left: `${trimInPct}%`, width: `${trimOutPct - trimInPct}%` }}
                  />
                  {/* Dimmed region after out-point */}
                  <div
                    className="absolute inset-y-0 bg-black/10 pointer-events-none"
                    style={{ left: `${trimOutPct}%`, right: 0 }}
                  />
                </>
              )}
            </div>
          )}

          {/* Active track row (captions / music / overlays) */}
          {showTrack && (
            <div className="relative h-10 bg-white">
              {activeItems.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <button
                    className="pointer-events-auto flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToolbarAction?.(`add:${activeAction}`);
                    }}
                  >
                    + Add {activeAction}
                  </button>
                </div>
              ) : (
                activeItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="absolute inset-y-1.5 rounded-md bg-[#c7f038] flex items-center px-2"
                    style={{
                      left:  `${(item.startFrame / durationInFrames) * 100}%`,
                      width: `${((item.endFrame - item.startFrame) / durationInFrames) * 100}%`,
                    }}
                  >
                    <span className="text-[10px] font-medium text-neutral-800 truncate">
                      {item.label ?? item.text ?? ""}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Trim handles — span full height of ruler + track row */}
          {showTrim && durationInFrames > 0 && (
            <>
              {/* In-point handle */}
              <div
                className="absolute top-0 bottom-0 w-0.75 bg-[#c7f038] z-20 cursor-col-resize pointer-events-none"
                style={{ left: `${trimInPct}%` }}
              >
                <div className="absolute -top-px left-0 w-4 h-4 bg-[#c7f038] rounded-br-md flex items-center justify-center">
                  <div className="w-px h-2.5 bg-neutral-800 rounded-full" />
                </div>
              </div>
              {/* Out-point handle */}
              <div
                className="absolute top-0 bottom-0 w-0.75 bg-[#c7f038] z-20 cursor-col-resize pointer-events-none"
                style={{ left: `${trimOutPct}%` }}
              >
                <div className="absolute -top-px -left-3.25 w-4 h-4 bg-[#c7f038] rounded-bl-md flex items-center justify-center">
                  <div className="w-px h-2.5 bg-neutral-800 rounded-full" />
                </div>
              </div>
            </>
          )}

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-px bg-neutral-900 z-10 pointer-events-none"
            style={{ left: `${playheadPct}%` }}
          >
            <div className="w-3 h-3 bg-neutral-900 rounded-full -translate-x-[5px] -translate-y-px" />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
