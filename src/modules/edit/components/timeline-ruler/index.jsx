"use client";

import { useEffect, useRef, useState } from "react";
import { Captions, Music, Scissors, Type } from "lucide-react";

const TOOLBAR_ACTIONS = [
  { id: "trim",     label: "Trim",                   Icon: Scissors },
  { id: "captions", label: "Captions",                Icon: Captions },
  { id: "music",    label: "Music",                   Icon: Music },
  { id: "overlays", label: "Text / Image Overlays",   Icon: Type },
];

const HANDLE_HIT_PX = 10;
const PEAK_BUCKETS  = 300;

function useWaveformPeaks(audioUrl) {
  const [peaks, setPeaks]     = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!audioUrl) return;
    let cancelled = false;
    setLoading(true);
    setPeaks(null);

    (async () => {
      try {
        const res = await fetch(audioUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf     = await res.arrayBuffer();
        if (cancelled) return;
        const actx    = new AudioContext();
        const decoded = await actx.decodeAudioData(buf);
        if (cancelled) return;

        const data      = decoded.getChannelData(0);
        const blockSize = Math.max(1, Math.floor(data.length / PEAK_BUCKETS));
        const result    = new Float32Array(PEAK_BUCKETS);
        for (let i = 0; i < PEAK_BUCKETS; i++) {
          let max = 0;
          const start = i * blockSize;
          const end   = Math.min(start + blockSize, data.length);
          for (let j = start; j < end; j++) {
            const abs = Math.abs(data[j]);
            if (abs > max) max = abs;
          }
          result[i] = max;
        }
        if (!cancelled) setPeaks(result);
      } catch (err) {
        console.error("[Waveform] failed to load audio peaks:", err.message, audioUrl);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [audioUrl]);

  return { peaks, loading };
}

function Waveform({ peaks, loading, trimIn, trimOut, durationInFrames }) {
  if (!durationInFrames) return null;

  const inIdx  = Math.floor((trimIn  / durationInFrames) * PEAK_BUCKETS);
  const outIdx = Math.ceil( (trimOut / durationInFrames) * PEAK_BUCKETS);

  if (loading) {
    return (
      <div className="absolute inset-y-1 left-0 right-0 flex items-center gap-px px-1 pointer-events-none overflow-hidden"
           style={{ left: `${(trimIn / durationInFrames) * 100}%`, width: `${((trimOut - trimIn) / durationInFrames) * 100}%`, position: "absolute" }}>
        {Array.from({ length: 32 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-full bg-neutral-400/50 animate-pulse"
            style={{ height: `${25 + Math.abs(Math.sin(i * 0.9)) * 50}%` }}
          />
        ))}
      </div>
    );
  }

  if (!peaks) return null;

  const slice    = Array.from(peaks).slice(inIdx, outIdx);
  const maxPeak  = Math.max(...slice, 0.01);
  const trimPct  = (trimIn  / durationInFrames) * 100;
  const widthPct = ((trimOut - trimIn) / durationInFrames) * 100;
  const n        = slice.length || 1;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ left: `${trimPct}%`, width: `${widthPct}%`, top: 0, bottom: 0, height: "100%" }}
      viewBox={`0 0 ${n} 100`}
      preserveAspectRatio="none"
    >
      {slice.map((peak, i) => {
        const barH = Math.max(3, (peak / maxPeak) * 76);
        return (
          <rect
            key={i}
            x={i + 0.1}
            y={(100 - barH) / 2}
            width={0.8}
            height={barH}
            fill="#166534"
            opacity={0.8}
          />
        );
      })}
    </svg>
  );
}

export function Timeline({
  durationInFrames,
  frame,
  fps,
  onSeek,
  onToolbarAction,
  onTrimChange,
  audioUrl  = null,
  captions  = [],
  music     = [],
  overlays  = [],
}) {
  const [activeAction, setActiveAction] = useState("trim");

  const [trimIn,  setTrimIn]  = useState(0);
  const [trimOut, setTrimOut] = useState(durationInFrames);
  const effectiveTrimOut = trimOut > 0 ? trimOut : durationInFrames;

  const { peaks, loading: waveformLoading } = useWaveformPeaks(audioUrl);

  const totalSeconds = durationInFrames / fps;
  const tickCount    = Math.ceil(totalSeconds) + 1;
  const playheadPct  = durationInFrames > 0 ? (frame / durationInFrames) * 100 : 0;
  const trimInPct    = durationInFrames > 0 ? (trimIn          / durationInFrames) * 100 : 0;
  const trimOutPct   = durationInFrames > 0 ? (effectiveTrimOut / durationInFrames) * 100 : 100;

  const scrubRef     = useRef(null);
  const dragging     = useRef(false);
  const draggingTrim = useRef(null);

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
    if (f !== null) onSeek(Math.max(trimIn, Math.min(effectiveTrimOut, f)));
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
      if (f !== null) onSeek(Math.max(trimIn, Math.min(effectiveTrimOut, f)));
    }
  };

  const onPointerUp = () => {
    dragging.current     = false;
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

        {activeAction === "trim" && durationInFrames > 0 && (
          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
            {formatTime(trimIn / fps)} – {formatTime(effectiveTrimOut / fps)}
          </span>
        )}
      </div>

      {/* Ruler + optional track */}
      <div className="flex">
        {(showTrack || showTrim) && (
          <div className="w-28 shrink-0 border-r border-border/50">
            <div className="h-8 border-b border-border/40 bg-muted/30" />
            <div className="h-20 flex items-center px-3 text-[11px] text-muted-foreground font-medium capitalize">
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
          <div className="relative h-8 border-b border-border/40 bg-muted/30">
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

            {showTrim && durationInFrames > 0 && (
              <>
                <div className="absolute inset-y-0 left-0 bg-black/20 pointer-events-none" style={{ width: `${trimInPct}%` }} />
                <div className="absolute inset-y-0 right-0 bg-black/20 pointer-events-none" style={{ left: `${trimOutPct}%` }} />
              </>
            )}
          </div>

          {/* Trim track row */}
          {showTrim && (
            <div className="relative h-20 bg-white">
              {durationInFrames > 0 && (
                <>
                  {/* Dimmed region before in-point */}
                  <div
                    className="absolute inset-y-0 left-0 bg-black/10 pointer-events-none"
                    style={{ width: `${trimInPct}%` }}
                  />
                  {/* Active trim region bar */}
                  <div
                    className="absolute inset-y-3 bg-[#c7f038]/30 border border-[#c7f038]/60 rounded-sm pointer-events-none"
                    style={{ left: `${trimInPct}%`, width: `${trimOutPct - trimInPct}%` }}
                  />
                  {/* Dimmed region after out-point */}
                  <div
                    className="absolute inset-y-0 bg-black/10 pointer-events-none"
                    style={{ left: `${trimOutPct}%`, right: 0 }}
                  />
                  {/* Waveform — rendered only within trim region */}
                  <Waveform
                    peaks={peaks}
                    loading={waveformLoading}
                    trimIn={trimIn}
                    trimOut={effectiveTrimOut}
                    durationInFrames={durationInFrames}
                  />
                </>
              )}
            </div>
          )}

          {/* Active track row (captions / music / overlays) */}
          {showTrack && (
            <div className="relative h-20 bg-white">
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

          {/* Trim handles */}
          {showTrim && durationInFrames > 0 && (
            <>
              {/* In-point handle */}
              <div
                className="absolute top-0 bottom-0 w-0.75 bg-[#c7f038] z-20 pointer-events-none"
                style={{ left: `${trimInPct}%` }}
              >
                <div className="absolute -top-px left-0 w-4 h-4 bg-[#c7f038] rounded-br-md flex items-center justify-center">
                  <div className="w-px h-2.5 bg-neutral-800 rounded-full" />
                </div>
                <span className="absolute top-5 left-1 bg-neutral-900 text-white text-[9px] tabular-nums px-1 py-px rounded whitespace-nowrap">
                  {formatTime(trimIn / fps)}
                </span>
              </div>
              {/* Out-point handle */}
              <div
                className="absolute top-0 bottom-0 w-0.75 bg-[#c7f038] z-20 pointer-events-none"
                style={{ left: `${trimOutPct}%` }}
              >
                <div className="absolute -top-px -left-3.25 w-4 h-4 bg-[#c7f038] rounded-bl-md flex items-center justify-center">
                  <div className="w-px h-2.5 bg-neutral-800 rounded-full" />
                </div>
                <span className="absolute top-5 right-1 -translate-x-full bg-neutral-900 text-white text-[9px] tabular-nums px-1 py-px rounded whitespace-nowrap">
                  {formatTime(effectiveTrimOut / fps)}
                </span>
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
  const clamped = Math.max(0, seconds);
  const m  = Math.floor(clamped / 60);
  const s  = Math.floor(clamped % 60);
  const ms = Math.floor((clamped % 1) * 1000);
  return `${m}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}
