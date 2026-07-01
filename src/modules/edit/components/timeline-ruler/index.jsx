"use client";

import { useRef, useState } from "react";
import { Captions, Music, Type } from "lucide-react";

const TRACKS = [
  { id: "segments",      label: "Segments",      bar: "bg-neutral-800" },
  { id: "captions",      label: "Captions",      bar: "bg-[#c7f038]" },
  { id: "text-overlays", label: "Text Overlays", bar: "bg-neutral-300" },
];

const TOOLBAR_ACTIONS = [
  { id: "captions",  label: "Captions",            Icon: Captions },
  { id: "music",     label: "Music",                Icon: Music },
  { id: "overlays",  label: "Text / Image Overlays", Icon: Type },
];

export function Timeline({ durationInFrames, frame, fps, onSeek, onDownload, rendering, onToolbarAction }) {
  const [activeAction, setActiveAction] = useState(null);
  const totalSeconds = durationInFrames / fps;
  const tickCount = Math.ceil(totalSeconds) + 1;
  const playheadPct = durationInFrames > 0 ? (frame / durationInFrames) * 100 : 0;
  const scrubRef = useRef(null);
  const dragging = useRef(false);

  const seekFromPointer = (e) => {
    const el = scrubRef.current;
    if (!el || durationInFrames === 0) return;
    const { left, width } = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - left) / width));
    onSeek(Math.round(ratio * (durationInFrames - 1)));
  };

  const onPointerDown = (e) => {
    dragging.current = true;
    scrubRef.current?.setPointerCapture(e.pointerId);
    seekFromPointer(e);
  };
  const onPointerMove = (e) => { if (dragging.current) seekFromPointer(e); };
  const onPointerUp   = () => { dragging.current = false; };

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
      </div>

      {/* Ruler + tracks */}
      <div className="flex">
        {/* Left labels column */}
        <div className="w-28 shrink-0 border-r border-border/50">
          <div className="h-6 border-b border-border/40 bg-muted/30" />
          {TRACKS.map((track) => (
            <div
              key={track.id}
              className="h-9 flex items-center px-3 border-b border-border/40 text-[11px] text-muted-foreground font-medium truncate"
            >
              {track.label}
            </div>
          ))}
        </div>

        {/* Scrubable timeline area */}
        <div
          ref={scrubRef}
          className="flex-1 overflow-x-auto relative cursor-col-resize select-none"
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
          </div>

          {/* Track rows */}
          {TRACKS.map((track) => (
            <div key={track.id} className="relative h-9 border-b border-border/40 bg-white">
              <div
                className={`absolute inset-y-2 left-0.5 right-0.5 rounded-md ${track.bar} flex items-center px-2.5`}
              >
                <span className={`text-[10px] font-medium truncate ${track.id === "captions" ? "text-neutral-800" : track.id === "text-overlays" ? "text-neutral-500" : "text-white"}`}>
                  {track.label}
                </span>
              </div>
            </div>
          ))}

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
