"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Music, Pause, Play, Volume2, X } from "lucide-react";

function formatTime(seconds) {
  const clamped = Math.max(0, seconds || 0);
  const m = Math.floor(clamped / 60);
  const s = Math.floor(clamped % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Right-panel music library + trim controls.
 *
 * Browsing: a shared <audio> element previews whichever track row is
 * playing, with a scrub bar to audition any part of it.
 *
 * Selecting a track shows a ruler spanning the track's full length with a
 * draggable window sized to the reel's duration — the window's position is
 * the trim start, so the user picks which section of the track plays under
 * the video instead of always using the beginning.
 */
export function MusicPanel({ music, reelDurationSeconds, onSelect, onTrimChange, onVolumeChange, onClear }) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewingKey, setPreviewingKey] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef(null);
  const rulerRef = useRef(null);
  const dragRef = useRef(null);
  const previewWindowRef = useRef(false); // true while auditioning the trimmed window (auto-stop at the end)

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/music-library");
        const data = await res.json();
        if (!cancelled) setTracks(data.tracks || []);
      } catch (err) {
        console.error("[MusicPanel] Failed to load library:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      setCurrentTime(el.currentTime);
      if (
        previewWindowRef.current &&
        music &&
        el.currentTime >= music.trimStart + reelDurationSeconds
      ) {
        el.pause();
        el.currentTime = music.trimStart;
      }
    };
    const onLoadedMetadata = () => setDuration(el.duration || 0);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("loadedmetadata", onLoadedMetadata);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, [music, reelDurationSeconds]);

  const loadTrack = (track) => {
    const el = audioRef.current;
    if (!el) return;
    previewWindowRef.current = false;
    setPreviewingKey(track.key);
    setDuration(0);
    el.src = track.url;
    el.currentTime = 0;
  };

  // The panel unmounts whenever the user switches to another tab (only
  // rendered while active), so a track selected earlier needs to be
  // re-loaded into the fresh <audio> element on remount — otherwise
  // `duration` never gets set and the ruler is stuck on "Loading track…".
  useEffect(() => {
    if (music) loadTrack(music);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [music?.key]);

  // Keep the preview's playback volume matching whatever will actually be
  // baked into the export.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = music?.volume ?? 0.25;
  }, [music?.volume]);

  const toggleRowPreview = (track) => {
    const el = audioRef.current;
    if (!el) return;
    if (previewingKey !== track.key) {
      loadTrack(track);
      el.play();
      return;
    }
    if (el.paused) el.play(); else el.pause();
  };

  const handleSelect = (track) => {
    onSelect(track);
    if (previewingKey !== track.key) loadTrack(track);
  };

  const toggleSelectedPreview = () => {
    const el = audioRef.current;
    if (!el || !music) return;
    if (previewingKey !== music.key) {
      loadTrack(music);
      el.currentTime = music.trimStart;
      previewWindowRef.current = true;
      el.play();
      return;
    }
    if (el.paused) {
      if (el.currentTime < music.trimStart || el.currentTime >= music.trimStart + reelDurationSeconds) {
        el.currentTime = music.trimStart;
      }
      previewWindowRef.current = true;
      el.play();
    } else {
      el.pause();
    }
  };

  const maxTrimStart = Math.max(0, duration - reelDurationSeconds);
  const windowWidthPercent = duration > 0 ? Math.min(100, (reelDurationSeconds / duration) * 100) : 100;
  const windowLeftPercent = duration > 0 ? (music?.trimStart / duration) * 100 : 0;

  const handleWindowPointerDown = (e) => {
    if (!music || maxTrimStart <= 0) return;
    e.preventDefault();
    const rect = rulerRef.current.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startTrim: music.trimStart, rectW: rect.width };

    const handleMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const deltaSeconds = ((ev.clientX - d.startX) / d.rectW) * duration;
      onTrimChange(Math.min(maxTrimStart, Math.max(0, d.startTrim + deltaSeconds)));
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
    <div className="flex flex-col gap-4">
      <audio ref={audioRef} className="hidden" />

      <p className="text-xs text-muted-foreground">
        Pick a background track, preview it, then drag the window to choose which part plays under your reel.
      </p>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-muted-foreground">Library</label>

        {loading && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-4 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading tracks…
          </div>
        )}

        {!loading && tracks.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">No music tracks found.</p>
        )}

        {tracks.map((track) => {
          const isRowPreviewing = previewingKey === track.key;
          const isSelected = music?.key === track.key;
          return (
            <div
              key={track.key}
              className={`flex flex-col gap-1.5 rounded-lg border px-2.5 py-2 transition-colors ${
                isSelected ? "border-neutral-900 bg-neutral-900/5" : "border-border/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleRowPreview(track)}
                  className="w-6 h-6 shrink-0 rounded-full bg-neutral-900 text-white flex items-center justify-center hover:bg-neutral-800 transition-colors"
                >
                  {isRowPreviewing && isPlaying ? (
                    <Pause className="w-3 h-3" />
                  ) : (
                    <Play className="w-3 h-3 ml-0.5" />
                  )}
                </button>
                <span className="flex-1 text-xs font-medium truncate capitalize">{track.name}</span>
                <button
                  onClick={() => handleSelect(track)}
                  className={`shrink-0 text-[11px] font-semibold rounded-md px-2 py-1 transition-colors ${
                    isSelected
                      ? "bg-[#c7f038] text-black"
                      : "bg-neutral-900 text-white hover:opacity-90"
                  }`}
                >
                  {isSelected ? "Selected" : "Use"}
                </button>
              </div>

              {isSelected && (
                <div className="flex flex-col gap-2 pt-1 border-t border-border/40 mt-1">
                  {duration > 0 ? (
                    <>
                      <label className="text-[11px] font-medium text-muted-foreground">Section</label>
                      <div
                        ref={rulerRef}
                        className="relative h-10 rounded-lg bg-neutral-200 overflow-hidden select-none"
                      >
                        <div
                          onPointerDown={handleWindowPointerDown}
                          className={`absolute inset-y-0 rounded-md border-2 border-[#c7f038] bg-[#c7f038]/30 ${
                            maxTrimStart > 0 ? "cursor-grab active:cursor-grabbing" : ""
                          }`}
                          style={{ left: `${windowLeftPercent}%`, width: `${windowWidthPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                        <span>{formatTime(music.trimStart)} – {formatTime(music.trimStart + reelDurationSeconds)}</span>
                        <span>of {formatTime(duration)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading track…
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5" />
                      Volume ({Math.round((music.volume ?? 0.25) * 100)}%)
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round((music.volume ?? 0.25) * 100)}
                      className="w-full accent-[#c7f038]"
                      onChange={(e) => {
                        const volume = Number(e.target.value) / 100;
                        if (audioRef.current) audioRef.current.volume = volume;
                        onVolumeChange(volume);
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleSelectedPreview}
                      disabled={duration === 0}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#c7f038] py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {previewingKey === music.key && isPlaying ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      Preview selection
                    </button>
                    <button
                      onClick={onClear}
                      className="shrink-0 text-white bg-red-500 rounded-md p-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
